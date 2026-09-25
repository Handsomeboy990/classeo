// The four Classéo e-mails. Pure functions: data in, subject, HTML and plain
// text out. Links are absolute and built by the caller from APP_URL.

import { renderEmail, type Block, type RenderedEmail } from "./layout";

export { escapeHtml, renderEmail, type RenderedEmail } from "./layout";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Porto-Novo" });

export type CredentialsEmailInput = {
  // "created": a new account. "reset": a manager generated a new temporary
  // password for an existing one.
  reason: "created" | "reset";
  firstName: string;
  email: string;
  roleName: string;
  scopeLabel: string;
  by: { name: string; roleName: string };
  password: string;
  signInUrl: string;
};

export function credentialsEmail(input: CredentialsEmailInput): RenderedEmail {
  const created = input.reason === "created";
  const facts: Block = {
    type: "facts",
    rows: [
      ["Identifiant", input.email],
      ["Rôle", input.roleName],
      ["Périmètre", input.scopeLabel],
    ],
  };
  const common: Block[] = [
    facts,
    { type: "code", label: "Mot de passe temporaire", value: input.password, hint: "Respectez les majuscules et les minuscules." },
    {
      type: "notice",
      tone: "warning",
      title: "À changer dès la première connexion",
      text: "Classéo vous demandera aussitôt de choisir votre propre mot de passe. Tant que ce n'est pas fait, aucune action n'est possible avec ce compte.",
    },
    { type: "button", label: "Se connecter à Classéo", href: input.signInUrl },
  ];
  if (created) {
    return renderEmail({
      subject: "Votre compte Classéo est prêt",
      preheader: `${input.by.name} vous a ouvert un compte ${input.roleName}.`,
      eyebrow: "Nouveau compte",
      title: `Bienvenue sur Classéo, ${input.firstName}`,
      blocks: [
        { type: "paragraph", text: `${input.by.name} (${input.by.roleName}) vous a ouvert un compte sur Classéo, la plateforme qui relie le ministère, les services déconcentrés, les écoles et les familles.` },
        ...common,
        { type: "small", text: "Vous n'attendiez pas ce compte ? Ne vous connectez pas et signalez-le à votre administration." },
      ],
    });
  }
  return renderEmail({
    subject: "Votre mot de passe Classéo a été réinitialisé",
    preheader: `${input.by.name} a généré un nouveau mot de passe temporaire pour votre compte.`,
    eyebrow: "Mot de passe réinitialisé",
    title: "Un nouveau mot de passe temporaire",
    blocks: [
      { type: "paragraph", text: `Bonjour ${input.firstName}, ${input.by.name} (${input.by.roleName}) a réinitialisé le mot de passe de votre compte. Vos sessions ouvertes ont été fermées et l'ancien mot de passe ne fonctionne plus.` },
      ...common,
      { type: "small", text: "Vous n'avez rien demandé ? Contactez votre administration sans attendre." },
    ],
  });
}

export function resetCodeEmail(input: { firstName: string; code: string; minutes: number; maxAttempts: number; codeUrl: string }): RenderedEmail {
  return renderEmail({
    subject: "Votre code de réinitialisation Classéo",
    preheader: `Code valable ${input.minutes} minutes, pour choisir un nouveau mot de passe.`,
    eyebrow: "Mot de passe oublié",
    title: "Votre code de réinitialisation",
    blocks: [
      { type: "paragraph", text: `Bonjour ${input.firstName}, vous avez demandé à réinitialiser le mot de passe de votre compte Classéo. Saisissez ce code sur la page de réinitialisation.` },
      { type: "code", label: "Code à 6 chiffres", value: input.code, hint: `Valable ${input.minutes} minutes, utilisable une seule fois.` },
      { type: "button", label: "Saisir le code", href: input.codeUrl },
      { type: "paragraph", text: `Après ${input.maxAttempts} essais incorrects, le code est désactivé : il faudra en demander un nouveau.` },
      {
        type: "notice",
        tone: "info",
        title: "Vous n'avez rien demandé ?",
        text: "Ignorez ce message : votre mot de passe reste inchangé. Ne communiquez ce code à personne, même à un agent qui se présente comme membre de l'équipe Classéo.",
      },
    ],
  });
}

export function passwordChangedEmail(input: { firstName: string; email: string; at: Date; signInUrl: string; forgotUrl: string }): RenderedEmail {
  return renderEmail({
    subject: "Votre mot de passe Classéo a été modifié",
    preheader: "Confirmation de sécurité : vos sessions ouvertes ont été fermées.",
    eyebrow: "Sécurité du compte",
    title: "Mot de passe modifié",
    blocks: [
      { type: "paragraph", text: `Bonjour ${input.firstName}, le mot de passe du compte ${input.email} a été modifié le ${dateTime.format(input.at)}.` },
      { type: "paragraph", text: "Par sécurité, toutes les sessions ouvertes avec ce compte ont été fermées. Reconnectez-vous avec votre nouveau mot de passe." },
      { type: "button", label: "Se connecter", href: input.signInUrl },
      {
        type: "notice",
        tone: "warning",
        title: "Ce n'était pas vous ?",
        text: `Demandez tout de suite un nouveau code depuis la page « Mot de passe oublié » (${input.forgotUrl}), puis prévenez votre administration.`,
      },
    ],
  });
}

// Labels of the notification kinds sent by e-mail.
export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  absence: "Absence",
  report_card: "Bulletin",
  request: "Demande",
  message: "Messagerie",
};

export function notificationEmail(input: { firstName: string; kind: string; title: string; body: string; url: string }): RenderedEmail {
  return renderEmail({
    subject: input.title,
    preheader: input.body.slice(0, 140),
    eyebrow: NOTIFICATION_KIND_LABELS[input.kind] ?? "Notification",
    title: input.title,
    blocks: [
      { type: "paragraph", text: `Bonjour ${input.firstName},` },
      { type: "paragraph", text: input.body },
      { type: "button", label: "Ouvrir dans Classéo", href: input.url },
      { type: "small", text: "Vous recevez ce message parce que cette information vous concerne sur Classéo. Toutes vos notifications restent disponibles dans votre espace." },
    ],
  });
}
