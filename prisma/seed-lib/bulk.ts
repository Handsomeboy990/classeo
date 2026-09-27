// Fast bulk inserts for the seed: one INSERT ... SELECT FROM unnest(...) per
// batch, every column sent as one text array and cast in the database. A
// batch of thousands of rows is a single round trip with a handful of
// parameters, which keeps the seed quick locally and over the network
// (Neon), where Prisma's createMany spends most of its time building and
// serialising the query.
//
// Column types come from information_schema, so a row only carries the
// fields it sets. Prisma fills ids and updatedAt on the client, not in the
// database: an id missing from a row gets a random UUID and a missing
// updatedAt the current time. Other missing fields take the column default
// (or null).

import { randomUUID } from "node:crypto";

import pg from "pg";

type Column = { name: string; cast: string; isArray: boolean; hasDefault: string | null };

type Value = string | number | boolean | Date | null | undefined | object;

function castOf(dataType: string, udt: string): { cast: string; isArray: boolean } {
  switch (dataType) {
    case "text":
    case "character varying":
      return { cast: "text", isArray: false };
    case "integer":
      return { cast: "int4", isArray: false };
    case "bigint":
      return { cast: "int8", isArray: false };
    case "boolean":
      return { cast: "bool", isArray: false };
    case "double precision":
      return { cast: "float8", isArray: false };
    case "numeric":
      return { cast: "numeric", isArray: false };
    case "jsonb":
      return { cast: "jsonb", isArray: false };
    case "date":
      return { cast: "date", isArray: false };
    case "timestamp without time zone":
      return { cast: "timestamp(3)", isArray: false };
    case "USER-DEFINED":
      return { cast: `"${udt}"`, isArray: false };
    case "ARRAY": {
      const element = udt.replace(/^_/, "");
      return { cast: element === "text" ? "text[]" : `"${element}"[]`, isArray: true };
    }
    default:
      throw new Error(`bulk insert: unsupported column type ${dataType} (${udt})`);
  }
}

function arrayLiteral(values: unknown[]) {
  return `{${values.map((v) => `"${String(v).replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;
}

function text(value: Value, column: Column): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (column.isArray) return arrayLiteral(value as unknown[]);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type Bulk = {
  insert: (table: string, rows: readonly object[], batch?: number) => Promise<number>;
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;
  end: () => Promise<void>;
};

export function createBulk(connectionString: string): Bulk {
  const pool = new pg.Pool({ connectionString, max: 3 });
  const tables = new Map<string, Map<string, Column>>();

  async function columnsOf(table: string) {
    let cols = tables.get(table);
    if (cols) return cols;
    const { rows } = await pool.query<{ column_name: string; data_type: string; udt_name: string; column_default: string | null }>(
      `SELECT column_name, data_type, udt_name, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (!rows.length) throw new Error(`bulk insert: unknown table ${table}`);
    cols = new Map(rows.map((r) => [r.column_name, { name: r.column_name, ...castOf(r.data_type, r.udt_name), hasDefault: r.column_default }]));
    tables.set(table, cols);
    return cols;
  }

  async function insert(table: string, input: readonly object[], batch = 5000) {
    if (!input.length) return 0;
    const rows = input as Record<string, Value>[];
    const cols = await columnsOf(table);
    const names = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) if (r[k] !== undefined) names.add(k);
    if (cols.has("id")) names.add("id");
    if (cols.has("updatedAt")) names.add("updatedAt");
    const list = [...names].map((n) => {
      const c = cols.get(n);
      if (!c) throw new Error(`bulk insert: ${table} has no column ${n}`);
      return c;
    });
    const now = new Date();
    const select = list
      .map((c, i) => {
        const cast = `u.c${i}::${c.cast}`;
        // A row without the field takes the column default, as an INSERT
        // leaving the column out would.
        return c.hasDefault && c.name !== "id" ? `COALESCE(${cast}, ${c.hasDefault})` : cast;
      })
      .join(", ");
    const sql = `INSERT INTO "${table}" (${list.map((c) => `"${c.name}"`).join(", ")}) SELECT ${select} FROM unnest(${list.map((_, i) => `$${i + 1}::text[]`).join(", ")}) AS u(${list.map((_, i) => `c${i}`).join(", ")})`;
    for (let start = 0; start < rows.length; start += batch) {
      const part = rows.slice(start, start + batch);
      const params = list.map((c) =>
        part.map((r) => {
          const v = r[c.name];
          if (v === undefined || v === null) {
            if (c.name === "id") return randomUUID();
            if (c.name === "updatedAt") return now.toISOString();
          }
          return text(v, c);
        }),
      );
      await pool.query(sql, params);
    }
    return rows.length;
  }

  return {
    insert,
    query: async (sql, params = []) => (await pool.query(sql, params)).rows,
    end: () => pool.end(),
  };
}
