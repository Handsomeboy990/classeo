// Every French text of the public pages (home, sign in, forgotten password,
// photo credits). The list is closed: its Fon and Yoruba translations are
// prepared ahead of time (scripts/pretranslate.ts --public), shipped with
// the seed and loaded into production by scripts/seed-public-translations.ts.
// A signed out visitor never makes the application call the translation
// service: a text missing from the cache is simply shown in French.
//
// Shared by server pages, client forms and scripts: no server import here.

import { photoTexts } from "./photos";

export const PUBLIC = {
  common: {
    language: "Langue",
    voice: "Voix",
    signIn: "Se connecter",
    home: "Classéo, accueil",
    backHome: "Retour à l'accueil",
    listen: "Écouter",
    moreInfo: "Plus d'informations",
    listenFon: "Écouter en fongbe",
    listenYo: "Écouter en yoruba",
    photo: "Photo",
    footerNav: "Liens du pied de page",
    footerNote: "Classéo, la plateforme de gestion scolaire pour le Bénin.",
    offline: "Utiliser Classéo hors ligne",
    credits: "Crédits photos",
    machine: "Traduction automatique : en cas de doute, le texte français fait foi.",
  },
  landing: {
    title: "Le système éducatif, à portée de main.",
    purpose:
      "Inscriptions, notes, bulletins, présences, frais et messages : Classéo rassemble la vie de l'établissement, pour que l'équipe, les enseignants et les familles voient ce qui les concerne, au bon moment.",
    enter: "Accéder à mon espace",
    audience: "Pour les écoles, collèges et lycées du Bénin, leurs enseignants, les familles et les services de l'éducation.",
    bandTitle: "L'école au Bénin, en images",
    a11yTitle: "Accessible à tous",
    a11yVoice: "Chaque écran peut être lu à voix haute.",
    a11yBody:
      "Le texte s'agrandit, le contraste se renforce et tout se fait au clavier, avec un lecteur d'écran ou sur un petit téléphone. Les pages déjà ouvertes restent lisibles sans réseau.",
    a11ySettings: "Les réglages se trouvent sous le bouton rond, en bas à droite de chaque écran.",
  },
  signIn: {
    title: "Connexion",
    intro: "Entrez l'identifiant et le mot de passe remis par votre établissement ou votre service.",
    identifier: "Identifiant",
    identifierHint: "Votre prénom et votre nom, séparés par un point. Par exemple : afiavi.hounkpatin",
    identifierHelp: "Où trouver mon identifiant ?",
    identifierWhere: "Votre établissement vous le remet avec votre premier mot de passe. Il s'écrit en minuscules, sans accent ni espace.",
    identifierTwin: "Si une autre personne porte déjà le même nom, un chiffre est ajouté à la fin, par exemple afiavi.hounkpatin2.",
    identifierNoEmail: "Aucune adresse e-mail n'est nécessaire. Si votre compte en a une, vous pouvez aussi la saisir ici.",
    password: "Mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    forgot: "Mot de passe oublié ?",
    pending: "Connexion…",
    failed: "Connexion impossible",
    offline: "Le serveur ne répond pas. Vérifiez votre connexion à Internet, puis réessayez.",
  },
  help: {
    title: "Mot de passe oublié",
    description: "Saisissez votre identifiant : la personne qui gère votre compte recevra la demande et vous remettra un mot de passe temporaire.",
    asideTitle: "Mot de passe oublié : la personne qui gère votre compte vous aide.",
    asideBody:
      "Pas besoin d'adresse e-mail. Votre demande arrive chez la personne qui gère votre compte : elle vous remet un mot de passe temporaire, que vous remplacez à la connexion.",
    phone: "Téléphone pour vous rappeler",
    phoneHint: "Facultatif. Le numéro où la personne qui vous aide peut vous joindre.",
    submit: "Demander un nouveau mot de passe",
    pending: "Envoi…",
    sentTitle: "Demande transmise",
    sentBody:
      "Si cet identifiant correspond à un compte actif, votre demande est arrivée chez la personne qui gère votre compte : le chef d'établissement pour les élèves, les parents et le personnel, le service qui a créé le compte pour les autres. Elle vous remettra un mot de passe temporaire, en personne ou au numéro indiqué.",
    backToSignIn: "Retour à la connexion",
    byEmail: "Mon compte a une adresse e-mail : recevoir un code",
  },
  code: {
    asideTitle: "Mot de passe oublié : un code par e-mail.",
    // RESET_CODE_MINUTES (features/auth/reset-code.ts), checked by the tests.
    asideBody:
      "Le code est à usage unique et reste valable 15 minutes. Une fois le mot de passe changé, toutes les sessions ouvertes avec le compte sont fermées.",
    emailTitle: "Recevoir un code par e-mail",
    emailDescription: "Pour les comptes qui ont une adresse e-mail. Un code vous y sera envoyé pour choisir un nouveau mot de passe.",
    resetTitle: "Nouveau mot de passe",
    resetDescription: "Saisissez le code reçu par e-mail, puis choisissez votre nouveau mot de passe.",
  },
  credits: {
    title: "Crédits photos",
    intro:
      "Les photographies de Classéo montrent des écoles du Bénin. Elles viennent de Wikimedia Commons, où leurs auteurs les ont publiées sous une licence libre ou dans le domaine public.",
    reuse: "Chaque photographie est utilisée selon sa licence. Celles sous licence CC BY-SA sont partagées ici sous la même licence.",
    subject: "Sujet",
    author: "Auteur",
    source: "Source",
    sourceLink: "Voir l'original sur Wikimedia Commons",
    licence: "Licence",
    licenceLink: "Lire la licence",
    changes: "Modifications",
    publicDomain: "Domaine public",
    publicDomainNote: "Voir le statut sur la page source.",
    photos: "Photographies",
    voices: "Voix de lecture",
    voiceSource: "Voir la source",
    languages: "Langues locales",
    languagesThanks: "Merci à AWADEME Finanfa Ronaldo, grâce à qui Classéo se lit et s'écoute en langues locales.",
  },
  // Answers of the sign in and forgotten password actions, written in French
  // on the server (features/auth/actions.ts, features/password-help/actions.ts)
  // and looked up by the forms. A message with a figure that changes (a
  // number of minutes) is not listed: it stays in French.
  messages: {
    wrong: "Identifiant ou mot de passe incorrect.",
    locked: "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.",
    disabled: "Ce compte est désactivé. Contactez votre administrateur.",
    checkFields: "Vérifiez les champs du formulaire.",
    typeIdentifier: "Saisissez votre identifiant.",
    typePassword: "Saisissez votre mot de passe.",
    badPhone: "Numéro invalide : chiffres, espaces et + uniquement.",
  },
} as const;

// What a signed out visitor may hear, as the exact French source given to
// the voice. One line per text already in the list above, so that the
// voice finds each line translated in the cache (the speech service cuts a
// text at its line breaks).
export const PUBLIC_SPEECH = {
  landing: [PUBLIC.landing.title, PUBLIC.landing.purpose].join("\n"),
  signIn: [PUBLIC.signIn.intro, PUBLIC.signIn.identifierHint, PUBLIC.signIn.identifierWhere, PUBLIC.signIn.identifierNoEmail].join("\n"),
  help: [PUBLIC.help.title, PUBLIC.help.description, PUBLIC.help.asideBody].join("\n"),
} as const;

// Names that no translation may change: a translation that loses one of
// them is not used. Identifiers such as afiavi.hounkpatin are checked the
// same way (see translate.ts).
export const PROTECTED_NAMES = [
  "Classéo",
  "Bénin",
  "Wikimedia Commons",
  "CC BY-SA",
  "CC BY",
  "WebP",
  "Savi",
  "Godomey",
  "Grand-Popo",
  "AWADEME Finanfa Ronaldo",
] as const;

function values(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node && typeof node === "object") return Object.values(node).flatMap(values);
  return [];
}

// Label of the listen button for the chosen voice.
export function listenText(voice: string) {
  return voice === "fon" ? PUBLIC.common.listenFon : voice === "yo" ? PUBLIC.common.listenYo : PUBLIC.common.listen;
}

// Every French source of the public pages, once.
export function publicSources(): string[] {
  return [...new Set([...values(PUBLIC), ...photoTexts()])];
}
