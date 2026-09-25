import {
  Accessibility,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Inbox,
  Landmark,
  LayoutGrid,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  NotebookPen,
  ShieldCheck,
  Users,
  Volume2,
  Wallet,
  WifiOff,
} from "lucide-react";

import type { RoleCode } from "@/lib/auth/permissions";

// The guide, as data: one short journey per kind of user, each step a
// pictogram and one sentence, so it can be read, looked at or listened to.

export type Step = { icon: LucideIcon; title: string; text: string; href?: string };
export type Guide = { key: string; title: string; audience: string; roles: RoleCode[]; steps: Step[] };

export const GUIDES: Guide[] = [
  {
    key: "parent",
    title: "Je suis parent",
    audience: "Parents et tuteurs",
    roles: ["PARENT"],
    steps: [
      { icon: Volume2, title: "Écouter le résumé", text: "Sur le tableau de bord, appuyez sur le bouton vert « Écouter » : Kora vous dit l'essentiel sur chaque enfant.", href: "/espace" },
      { icon: FileText, title: "Voir le bulletin", text: "Ouvrez « Mes enfants », choisissez un enfant : le dernier bulletin s'affiche. Vous pouvez l'imprimer.", href: "/espace/suivi" },
      { icon: CalendarCheck, title: "Suivre les présences", text: "L'onglet « Présences » montre chaque demi-journée. Une absence est aussi signalée dans les notifications." },
      { icon: MessageCircle, title: "Écrire à l'école", text: "Dans « Messagerie », répondez au professeur ou au secrétariat. Un point rouge indique un nouveau message.", href: "/espace/messages" },
      { icon: Wallet, title: "Consulter les frais", text: "L'onglet « Frais » indique ce qui est payé, ce qui reste et la prochaine échéance." },
    ],
  },
  {
    key: "eleve",
    title: "Je suis élève",
    audience: "Élèves",
    roles: ["STUDENT"],
    steps: [
      { icon: CalendarDays, title: "Ma journée", text: "Le tableau de bord montre tes cours d'aujourd'hui, dans l'ordre, avec la salle.", href: "/espace" },
      { icon: NotebookPen, title: "Mes notes", text: "« Ma scolarité », puis « Notes du trimestre » : chaque note et ta moyenne provisoire, calculée pour toi.", href: "/espace/suivi" },
      { icon: BookOpen, title: "Mes ressources", text: "Les fiches et vidéos de ta classe sont sur le tableau de bord. Chaque vidéo a son texte écrit." },
      { icon: Volume2, title: "Tout écouter", text: "Chaque carte a un bouton « Écouter ». Tu peux changer la vitesse de la voix dans Accessibilité." },
    ],
  },
  {
    key: "enseignant",
    title: "Je suis enseignant",
    audience: "Enseignants",
    roles: ["TEACHER"],
    steps: [
      { icon: ClipboardCheck, title: "Faire l'appel", text: "« Présences » : choisissez la classe et la demi-journée, puis marquez les absents et les retards.", href: "/espace/presences" },
      { icon: NotebookPen, title: "Saisir les notes", text: "« Notes » : ouvrez la fiche de la matière, saisissez, la moyenne se calcule toute seule.", href: "/espace/notes" },
      { icon: Megaphone, title: "Publier une ressource", text: "« Annonces et ressources » : ajoutez une fiche. Pour une vidéo ou un audio, la transcription est obligatoire.", href: "/espace/contenus" },
      { icon: MessageCircle, title: "Échanger avec les familles", text: "« Messagerie » : écrivez à un parent. Il peut écouter votre message.", href: "/espace/messages" },
    ],
  },
  {
    key: "ecole",
    title: "Je dirige ou gère une école",
    audience: "Directions, secrétariats, comptabilité",
    roles: ["SCHOOL_DIRECTOR", "SECRETARY", "ACCOUNTANT"],
    steps: [
      { icon: Users, title: "Inscrire les élèves", text: "« Élèves » : inscrivez un élève dans une classe et rattachez ses parents par leur numéro de téléphone.", href: "/espace/eleves" },
      { icon: LayoutGrid, title: "Organiser les classes", text: "« Classes » et « Emploi du temps » : enseignants, matières, coefficients et horaires.", href: "/espace/classes" },
      { icon: FileText, title: "Publier les bulletins", text: "« Bulletins » : verrouillez les notes, vérifiez, publiez. Les parents sont prévenus aussitôt.", href: "/espace/bulletins" },
      { icon: Wallet, title: "Suivre les frais", text: "« Frais et paiements » : factures, échéanciers et paiements, avec reçu.", href: "/espace/frais" },
      { icon: Inbox, title: "Faire une demande", text: "« Demandes » : sollicitez la circonscription ou la direction départementale et suivez la réponse.", href: "/espace/demandes" },
    ],
  },
  {
    key: "ministere",
    title: "Je travaille au ministère ou dans ses services",
    audience: "Ministère, directions départementales, circonscriptions",
    roles: ["NATIONAL_ADMIN", "NATIONAL_ANALYST", "DEPARTMENT_DIRECTOR", "COMMUNE_INSPECTOR"],
    steps: [
      { icon: BarChart3, title: "Lire les statistiques", text: "« Statistiques » : effectifs, parité, réussite et présences, du pays jusqu'à l'école, en un clic.", href: "/espace/statistiques" },
      { icon: Landmark, title: "Suivre les établissements", text: "« Établissements » et « Territoire » : les écoles de votre périmètre, commune par commune.", href: "/espace/etablissements" },
      { icon: Inbox, title: "Traiter les demandes", text: "« Demandes » : accordez ou refusez, avec une note visible par l'école.", href: "/espace/demandes" },
      { icon: ShieldCheck, title: "Gérer les droits", text: "« Rôles et droits » : chaque changement est enregistré dans le journal d'activité.", href: "/espace/droits" },
    ],
  },
  {
    key: "partenaire",
    title: "Je représente un partenaire",
    audience: "ONG, partenaires techniques et financiers",
    roles: ["PARTNER"],
    steps: [
      { icon: BarChart3, title: "Consulter les indicateurs", text: "« Statistiques » : chiffres agrégés, jamais de données personnelles.", href: "/espace/statistiques" },
      { icon: Megaphone, title: "Lire les annonces", text: "« Annonces et ressources » : les communications du ministère.", href: "/espace/contenus" },
    ],
  },
];

export const FAQ: { icon: LucideIcon; q: string; a: string }[] = [
  {
    icon: Volume2,
    q: "Comment faire lire une page à voix haute ?",
    a: "Appuyez sur un bouton « Écouter » : en haut de chaque page, ou sur chaque carte. Appuyez sur « Arrêter » pour couper. La voix est celle de votre téléphone ou de votre ordinateur ; si aucune voix française n'est installée, un message vous l'indique.",
  },
  {
    icon: Accessibility,
    q: "Comment agrandir le texte ou renforcer le contraste ?",
    a: "Touchez le bouton Accessibilité, en haut à droite de l'écran, ou ouvrez « Accessibilité » dans le menu. Choisissez la taille du texte, le contraste élevé, le thème sombre et la vitesse de la voix. Les réglages restent enregistrés sur cet appareil.",
  },
  {
    icon: WifiOff,
    q: "Puis-je utiliser Classéo sans réseau ?",
    a: "Oui, en lecture. Les pages déjà ouvertes (tableau de bord, bulletins, notes, présences, emploi du temps) restent lisibles hors ligne. Un bandeau vous prévient quand la connexion est coupée. Les modifications attendent le retour du réseau.",
  },
  {
    icon: Bell,
    q: "Je ne sais pas bien lire. Comment savoir si tout va bien ?",
    a: "Chaque résultat a une image et une couleur : une étoile ou un pouce vert pour « bien », un trait orange pour « passable », un triangle rouge pour « insuffisant ». Le bouton « Écouter » dit tout à voix haute.",
  },
  {
    icon: MessageCircle,
    q: "Je suis sourd ou malentendant. Vais-je manquer une information ?",
    a: "Non. Aucune information n'est donnée seulement par le son : chaque résumé parlé est aussi écrit à côté du bouton, les vidéos ont leur transcription et les alertes sont des notifications écrites.",
  },
  {
    icon: Accessibility,
    q: "Puis-je tout faire au clavier ou avec un lecteur d'écran ?",
    a: "Oui. La touche Tab passe d'un élément à l'autre avec un cadre bien visible, le lien « Aller au contenu principal » apparaît en premier, et les pages sont structurées pour les lecteurs d'écran.",
  },
  {
    icon: ShieldCheck,
    q: "Qui peut voir les informations de mon enfant ?",
    a: "Vous, votre enfant, son établissement et les services habilités. Un autre parent ne peut jamais ouvrir sa fiche. Sur un téléphone partagé, déconnectez-vous : les copies hors ligne sont effacées.",
  },
];

export function guideFor(role: RoleCode) {
  return GUIDES.find((g) => g.roles.includes(role)) ?? GUIDES[0]!;
}

export function guideText(g: Guide) {
  return `${g.title}. ${g.steps.map((s, i) => `Étape ${i + 1} : ${s.title}. ${s.text}`).join(" ")}`;
}
