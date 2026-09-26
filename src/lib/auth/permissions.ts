// Permission catalogue and default roles.
// Shared by the seed script and the application, so it must stay free of
// server-only imports.

export const ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "export",
  "publish",
  "lock",
  "approve",
] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = {
  territory: "Territoire (départements, communes)",
  school: "Établissements",
  class: "Classes et matières",
  student: "Élèves et inscriptions",
  teacher: "Enseignants",
  parent: "Parents et tuteurs",
  grade: "Notes",
  report_card: "Bulletins",
  attendance: "Présences",
  timetable: "Emplois du temps",
  content: "Annonces et ressources",
  message: "Messagerie",
  request: "Demandes au ministère",
  statistics: "Statistiques",
  fee: "Frais scolaires",
  payment: "Paiements",
  user: "Comptes utilisateurs",
  role: "Rôles et droits",
  audit: "Journal d'activité",
  translation: "Traduction en langues locales",
  calendar: "Calendrier scolaire national",
  subject: "Catalogue des matières",
  document_request: "Pièces demandées aux établissements",
  mock_exam: "Examens blancs",
  family_document: "Pièces et justificatifs des familles",
  health_document: "Certificats médicaux et pièces de santé",
} as const;
export type Resource = keyof typeof RESOURCES;

export type PermissionCode = `${Resource}:${Action}`;

export const ACTION_LABELS: Record<Action, string> = {
  view: "Voir",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
  export: "Exporter",
  publish: "Publier",
  lock: "Verrouiller",
  approve: "Valider",
};

// Which actions make sense on which resource. The rights matrix only offers
// these cells.
const APPLICABLE: Record<Resource, Action[]> = {
  territory: ["view", "create", "update", "delete", "export"],
  // lock: suspend, close or reactivate a school (ministry chain only).
  school: ["view", "create", "update", "delete", "export", "lock"],
  class: ["view", "create", "update", "delete", "export"],
  student: ["view", "create", "update", "delete", "export"],
  teacher: ["view", "create", "update", "delete", "export"],
  parent: ["view", "create", "update", "delete", "export"],
  grade: ["view", "create", "update", "delete", "export", "lock"],
  report_card: ["view", "export", "publish"],
  attendance: ["view", "create", "update", "export"],
  timetable: ["view", "create", "update", "delete", "export"],
  content: ["view", "create", "update", "delete", "publish"],
  message: ["view", "create"],
  request: ["view", "create", "approve"],
  statistics: ["view", "export"],
  fee: ["view", "create", "update", "delete", "export"],
  payment: ["view", "create", "delete", "export"],
  user: ["view", "create", "update", "delete", "export"],
  role: ["view", "update"],
  audit: ["view", "export"],
  // Interface and content in Fon, Yoruba, Bariba... Parents by default; the
  // ministry extends it to other profiles from the rights matrix.
  translation: ["view"],
  // The ministry sets the years and their periods (create, update), closes a
  // year (lock) and grants extensions (approve). Everyone else reads it.
  calendar: ["view", "create", "update", "lock", "approve"],
  // The ministry owns the catalogue; schools propose through request:create.
  subject: ["view", "create", "update", "delete", "approve"],
  // An authority asks for pieces (create) and reviews them (approve); a
  // school uploads and submits them (update).
  document_request: ["view", "create", "update", "approve"],
  // view: exams and results in scope; create: organise (invite, submit,
  // close); update: enter results; approve: decide on an exam (hierarchy)
  // or on an invitation (invited school); export: results sheet.
  mock_exam: ["view", "create", "update", "export", "approve"],
  // A family sends pieces (create) and follows them (view); the school
  // examines them and keeps the list of pieces it asks for (approve).
  family_document: ["view", "create", "approve"],
  // Health pieces (medical certificates, vaccination records) are sensitive
  // data: only the staff holding this right open and decide them. Families
  // send them through family_document:create.
  health_document: ["view", "approve"],
};

export const PERMISSIONS: { code: PermissionCode; resource: Resource; action: Action; description: string }[] =
  (Object.keys(APPLICABLE) as Resource[]).flatMap((resource) =>
    APPLICABLE[resource].map((action) => ({
      code: `${resource}:${action}` as PermissionCode,
      resource,
      action,
      description: `${ACTION_LABELS[action]} : ${RESOURCES[resource]}`,
    })),
  );

export function isApplicable(resource: Resource, action: Action) {
  return APPLICABLE[resource].includes(action);
}

type ScopeLevelCode = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";

function all(resource: Resource): PermissionCode[] {
  return APPLICABLE[resource].map((a) => `${resource}:${a}` as PermissionCode);
}
function only(resource: Resource, ...actions: Action[]): PermissionCode[] {
  return actions.filter((a) => isApplicable(resource, a)).map((a) => `${resource}:${a}` as PermissionCode);
}

export type RoleCode =
  | "NATIONAL_ADMIN"
  | "NATIONAL_ANALYST"
  | "DEPARTMENT_DIRECTOR"
  | "COMMUNE_INSPECTOR"
  | "SCHOOL_DIRECTOR"
  | "SECRETARY"
  | "ACCOUNTANT"
  | "TEACHER"
  | "PARENT"
  | "STUDENT"
  | "PARTNER";

export const DEFAULT_ROLES: {
  code: RoleCode;
  name: string;
  description: string;
  scopeLevel: ScopeLevelCode;
  permissions: PermissionCode[];
}[] = [
  {
    code: "NATIONAL_ADMIN",
    name: "Administrateur national",
    description: "Ministère, administration centrale. Tous les droits sur tout le territoire.",
    scopeLevel: "NATIONAL",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  {
    code: "NATIONAL_ANALYST",
    name: "Analyste national",
    description: "Ministère, cellule des statistiques. Consultation et export, sans modification.",
    scopeLevel: "NATIONAL",
    permissions: [
      ...only("territory", "view", "export"),
      ...only("school", "view", "export"),
      ...all("statistics"),
      ...only("content", "view"),
      ...only("request", "view"),
      ...only("calendar", "view"),
      ...only("subject", "view"),
      ...only("document_request", "view"),
      ...only("mock_exam", "view", "export"),
    ],
  },
  {
    code: "DEPARTMENT_DIRECTOR",
    name: "Directeur départemental",
    description: "Direction départementale. Pilote les communes et établissements de son département.",
    scopeLevel: "DEPARTMENT",
    permissions: [
      ...only("territory", "view", "export"),
      ...only("school", "view", "create", "update", "export", "lock"),
      ...only("calendar", "view"),
      ...only("subject", "view"),
      ...only("document_request", "view", "create", "approve"),
      ...only("class", "view"),
      ...only("student", "view", "export"),
      ...only("teacher", "view", "export"),
      ...only("grade", "view"),
      ...only("report_card", "view"),
      ...only("attendance", "view"),
      ...all("content"),
      ...all("message"),
      ...only("request", "view", "approve"),
      ...all("statistics"),
      ...only("user", "view", "create", "update"),
      // Roles of its own department, within the rights it holds.
      ...only("role", "view", "update"),
      ...only("audit", "view"),
      ...only("mock_exam", "view", "create", "approve", "export"),
    ],
  },
  {
    code: "COMMUNE_INSPECTOR",
    name: "Chef de circonscription",
    description: "Circonscription scolaire. Suit et appuie les établissements de sa commune.",
    scopeLevel: "COMMUNE",
    permissions: [
      ...only("territory", "view"),
      ...only("school", "view", "update", "export", "lock"),
      ...only("calendar", "view"),
      ...only("subject", "view"),
      ...only("document_request", "view", "create", "approve"),
      ...only("class", "view"),
      ...only("student", "view"),
      ...only("teacher", "view"),
      ...only("grade", "view"),
      ...only("report_card", "view"),
      ...only("attendance", "view"),
      ...only("content", "view", "create", "update", "publish"),
      ...all("message"),
      ...only("request", "view", "approve"),
      ...all("statistics"),
      // Handles the password help requests of the school heads of its
      // commune, and creates roles for its own staff.
      ...only("user", "view", "update"),
      ...only("role", "view", "update"),
      ...only("audit", "view"),
      ...only("mock_exam", "view", "create", "approve", "export"),
    ],
  },
  {
    code: "SCHOOL_DIRECTOR",
    name: "Chef d'établissement",
    description: "Directeur ou proviseur. Tous les droits sur son établissement.",
    scopeLevel: "SCHOOL",
    permissions: [
      ...only("school", "view", "update"),
      ...only("calendar", "view"),
      ...only("subject", "view"),
      ...only("document_request", "view", "update"),
      ...all("class"),
      ...all("student"),
      ...all("teacher"),
      ...all("parent"),
      ...all("grade"),
      ...all("report_card"),
      ...all("attendance"),
      ...all("timetable"),
      ...all("content"),
      ...all("message"),
      ...only("request", "view", "create"),
      ...all("statistics"),
      ...all("fee"),
      ...all("payment"),
      ...only("user", "view", "create", "update"),
      // Roles of its own school (a supervisor, a bursar...), within the
      // rights it holds.
      ...only("role", "view", "update"),
      ...only("audit", "view"),
      ...all("mock_exam"),
      ...only("family_document", "view", "approve"),
      ...all("health_document"),
    ],
  },
  {
    code: "SECRETARY",
    name: "Secrétaire",
    description: "Secrétariat. Consulte l'établissement et gère les inscriptions, sans suppression.",
    scopeLevel: "SCHOOL",
    permissions: [
      ...only("school", "view"),
      ...only("calendar", "view"),
      ...only("subject", "view"),
      ...only("document_request", "view", "update"),
      ...only("class", "view"),
      ...only("student", "view", "create", "update", "export"),
      ...only("teacher", "view"),
      ...only("parent", "view", "create", "update"),
      ...only("report_card", "view", "export"),
      ...only("attendance", "view", "export"),
      ...only("timetable", "view"),
      ...only("content", "view"),
      ...all("message"),
      ...only("request", "view"),
      ...only("statistics", "view"),
      ...only("mock_exam", "view"),
      // Enrollment pieces and absence justifications; health pieces stay
      // with the head of school unless a role grants them.
      ...only("family_document", "view", "approve"),
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Comptable",
    description: "Comptabilité. Frais et paiements de l'établissement, listes en lecture seule.",
    scopeLevel: "SCHOOL",
    permissions: [
      ...only("school", "view"),
      ...only("calendar", "view"),
      ...only("class", "view"),
      ...only("student", "view"),
      ...only("parent", "view"),
      ...all("fee"),
      ...all("payment"),
      ...only("statistics", "view"),
      ...all("message"),
    ],
  },
  {
    code: "TEACHER",
    name: "Enseignant",
    description: "Saisit les notes et les présences de ses classes, publie des ressources pour ses élèves.",
    scopeLevel: "SCHOOL",
    permissions: [
      ...only("calendar", "view"),
      ...only("class", "view"),
      ...only("student", "view"),
      ...only("grade", "view", "create", "update", "delete", "export"),
      ...only("report_card", "view"),
      ...only("attendance", "view", "create", "update"),
      ...only("timetable", "view"),
      ...only("content", "view", "create", "update", "publish"),
      ...all("message"),
      ...only("mock_exam", "view", "update"),
    ],
  },
  {
    code: "PARENT",
    name: "Parent ou tuteur",
    description: "Suit la scolarité de ses enfants et échange avec l'école.",
    scopeLevel: "SELF",
    permissions: [
      ...only("translation", "view"),
      ...only("student", "view"),
      ...only("grade", "view"),
      ...only("report_card", "view"),
      ...only("attendance", "view"),
      ...only("timetable", "view"),
      ...only("content", "view"),
      ...all("message"),
      ...only("fee", "view"),
      ...only("payment", "view"),
      ...only("mock_exam", "view"),
      ...only("family_document", "view", "create"),
    ],
  },
  {
    code: "STUDENT",
    name: "Élève",
    description: "Consulte ses notes, son bulletin, ses présences et les ressources de sa classe.",
    scopeLevel: "SELF",
    permissions: [
      ...only("grade", "view"),
      ...only("report_card", "view"),
      ...only("attendance", "view"),
      ...only("timetable", "view"),
      ...only("content", "view"),
      ...all("message"),
      ...only("mock_exam", "view"),
      // Sending is allowed from 16 years of age, never for health pieces
      // (see src/features/family-documents/rules.ts).
      ...only("family_document", "view", "create"),
    ],
  },
  {
    code: "PARTNER",
    name: "Structure partenaire",
    description: "ONG, partenaire technique ou financier. Statistiques agrégées en lecture seule.",
    scopeLevel: "NATIONAL",
    permissions: [...only("statistics", "view"), ...only("school", "view"), ...only("content", "view")],
  },
];
