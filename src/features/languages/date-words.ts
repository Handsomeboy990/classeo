import type { TargetLanguage } from "./languages";

// Day and month names of the dates the interface prints in French ("Jeudi 12
// septembre 2026", "25 sept. à 14 h 05", "sept" on a calendar leaf). A
// machine translation of "Jeu." or "sept." out of context is unusable, so the
// words come from a table, Monday first and January first:
// - Yoruba, Ewe, Hausa: the CLDR names (as given by Intl.DateTimeFormat);
// - Fon, which CLDR lacks: the names returned by the translation service for
//   the full words, the same on every call ("nyɔnuzangbé" as the service
//   spells it in a sentence). To be checked by a Fon speaker.
// Languages without a table keep the French dates.
type Words = { days: readonly string[]; months: readonly string[] };

export const DATE_WORDS: Partial<Record<TargetLanguage, Words>> = {
  fon: {
    days: ["tɛnigbé", "taatagbé", "azangagbé", "nyɔnuzangbé", "axɔ́sùzàn", "síbígbé", "vodungbé"],
    months: ["aluunsu", "zofinkplɔsun", "xwéjisun", "lidosun", "nuxwasun", "ayidosu", "liyasun", "avivɔsun", "zosun", "zŏsùn", "abɔxwisun", "wosun"],
  },
  yo: {
    days: ["Ajé", "Ìsẹ́gun", "Ọjọ́rú", "Ọjọ́bọ", "Ẹtì", "Àbámẹ́ta", "Àìkú"],
    months: ["Oṣù Ṣẹ́rẹ́", "Oṣù Èrèlè", "Oṣù Ẹrẹ̀nà", "Oṣù Ìgbé", "Oṣù Ẹ̀bibi", "Oṣù Òkúdu", "Oṣù Agẹmọ", "Oṣù Ògún", "Oṣù Owewe", "Oṣù Ọ̀wàrà", "Oṣù Bélú", "Oṣù Ọ̀pẹ̀"],
  },
  ee: {
    days: ["dzoɖa", "blaɖa", "kuɖa", "yawoɖa", "fiɖa", "memleɖa", "kɔsiɖa"],
    months: ["dzove", "dzodze", "tedoxe", "afɔfĩe", "dame", "masa", "siamlɔm", "deasiamime", "anyɔnyɔ", "kele", "adeɛmekpɔxe", "dzome"],
  },
  ha: {
    days: ["Litinin", "Talata", "Laraba", "Alhamis", "Jummaʼa", "Asabar", "Lahadi"],
    months: ["Janairu", "Faburairu", "Maris", "Afirilu", "Mayu", "Yuni", "Yuli", "Agusta", "Satumba", "Oktoba", "Nuwamba", "Disamba"],
  },
};

// The French forms Intl.DateTimeFormat("fr-FR") writes, long and short.
const FR_DAYS = [
  ["lundi", "lun"],
  ["mardi", "mar"],
  ["mercredi", "mer"],
  ["jeudi", "jeu"],
  ["vendredi", "ven"],
  ["samedi", "sam"],
  ["dimanche", "dim"],
];
const FR_MONTHS = [
  ["janvier", "janv"],
  ["février", "févr"],
  ["mars"],
  ["avril", "avr"],
  ["mai"],
  ["juin"],
  ["juillet", "juil"],
  ["août"],
  ["septembre", "sept"],
  ["octobre", "oct"],
  ["novembre", "nov"],
  ["décembre", "déc"],
];

function indexIn(table: string[][], word: string, abbreviated: boolean) {
  // A short day name only counts with its full stop ("mar." is Tuesday,
  // "mars" is March); a short month also without it (calendar leaves).
  return table.findIndex(([full, short]) => word === full || (!!short && word === short && (abbreviated || table === FR_MONTHS)));
}

function capitalise(word: string, like: string) {
  return like.charAt(0) === like.charAt(0).toLowerCase() ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

// The date in the reader's language when the text is a date and nothing
// else: day and month names from the table, figures kept, "14 h 05" written
// "14:05", "à" a comma and "au" a dash (no word of French left), "1er"
// written "1".
// Undefined when the text holds any other word, or the language has no
// table.
export function translateDate(text: string, lang: TargetLanguage): string | undefined {
  const words = DATE_WORDS[lang];
  if (!words) return undefined;
  let found = false;
  let rest = false;
  const out = text
    .replace(/\b(\d{1,2}) h(?: (\d{2}))?\b/g, (_, h: string, m?: string) => `${h.padStart(2, "0")}:${m ?? "00"}`)
    .replace(/\b1er\b/g, "1")
    .replace(/\s+à\s+/g, ", ")
    // "du 21 septembre au 23 septembre", "le jeudi 24 septembre": a range
    // written with a dash, the article dropped.
    .replace(/^(?:du|le)\s+/i, "")
    .replace(/\s+au\s+/g, " – ")
    .replace(/\p{L}+(\.)?/gu, (token, dot?: string) => {
      const word = (dot ? token.slice(0, -1) : token).toLowerCase();
      const day = indexIn(FR_DAYS, word, !!dot);
      if (day >= 0) {
        found = true;
        return capitalise(words.days[day]!, token);
      }
      const month = indexIn(FR_MONTHS, word, !!dot);
      if (month >= 0) {
        found = true;
        return capitalise(words.months[month]!, token);
      }
      rest = true;
      return token;
    });
  return found && !rest ? out : undefined;
}

// Whether a text is a date the table can write, whatever the language.
export function isDate(text: string) {
  return translateDate(text, "yo") !== undefined;
}

// "Publié le 22 septembre 2026": the words before a date, when the text ends
// with one. The label is looked up in the cache, the date in the table.
export function dateLabel(text: string): { label: string; date: string } | null {
  const words = text.split(" ");
  for (let i = 1; i < words.length; i++) {
    // The article stays with the label: "Publié le", "Absent le".
    if (/^(?:le|du)$/i.test(words[i]!)) continue;
    const date = words.slice(i).join(" ");
    if (isDate(date)) return { label: words.slice(0, i).join(" "), date };
  }
  return null;
}

// A date alone, or after a label the cache knows: "Publié le 22 septembre
// 2026" gives the translated label followed by the date from the table.
export function translateDated(text: string, lang: TargetLanguage, map: Map<string, string>): string | undefined {
  const alone = translateDate(text, lang);
  if (alone) return alone;
  const parts = dateLabel(text);
  const label = parts && (map.get(parts.label) ?? map.get(parts.label.replace(/\s*[:,]$/, "")));
  const date = parts && translateDate(parts.date, lang);
  return label && date ? `${label} ${date}` : undefined;
}
