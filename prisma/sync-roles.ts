// Brings an existing database up to the default permission catalogue and
// roles, without removing anything: permissions and roles are created when
// missing, and default role grants are added when missing. Grants removed or
// added by an administrator in the rights matrix are left as they are.
// Idempotent, safe to run on every deployment.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/lib/auth/permissions";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const createdPermissions = await db.permission.createMany({ data: PERMISSIONS, skipDuplicates: true });
  const permIds = new Map((await db.permission.findMany()).map((p) => [p.code, p.id]));

  let createdRoles = 0;
  let addedGrants = 0;
  let renamedRoles = 0;
  for (const role of DEFAULT_ROLES) {
    const existing = await db.role.findUnique({ where: { code: role.code } });
    const r =
      existing ??
      (await db.role.create({
        data: { code: role.code, name: role.name, description: role.description, scopeLevel: role.scopeLevel, isSystem: true },
      }));
    if (!existing) createdRoles++;
    // System roles keep the names and descriptions of the catalogue (they are
    // not editable in the application), so a corrected label reaches
    // existing databases.
    else if (existing.isSystem && (existing.name !== role.name || existing.description !== role.description)) {
      await db.role.update({ where: { id: existing.id }, data: { name: role.name, description: role.description } });
      renamedRoles++;
    }
    const result = await db.rolePermission.createMany({
      data: role.permissions.map((code) => ({ roleId: r.id, permissionId: permIds.get(code)! })),
      skipDuplicates: true,
    });
    addedGrants += result.count;
  }
  console.log(`permissions created: ${createdPermissions.count}, roles created: ${createdRoles}, roles relabelled: ${renamedRoles}, grants added: ${addedGrants}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
