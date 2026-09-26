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
      { icon: Volume2, title: "Écouter le résumé", text: "Sur le tableau de bord, appuyez sur « Écouter » : la voix lit le résumé de chaque enfant.", href: "/espace" },
      { icon: FileText, title: "Voir le bulletin", text: "Ouvrez « Mes enfants » et choisissez un enfant : son dernier bulletin s'affiche, prêt à imprimer.", href: "/espace/suivi" },
      { icon: CalendarCheck, title: "Suivre les présences", text: "L'onglet « Présences » montre chaque demi-journée. Chaque absence est aussi signalée par une notification." },
      { icon: MessageCircle, title: "Écrire à l'école", text: "Dans « Messagerie », répondez au professeur ou au secrétariat. Un nombre sur fond rouge indique les messages non lus.", href: "/espace/messages" },
      { icon: Wallet, title: "Consulter les frais", text: "L'onglet « Frais » indique ce qui est payé, ce qui reste à payer et la prochaine échéance." },
    ],
  },
  {
    key: "eleve",
    title: "Je suis élève",
    audience: "Élèves",
    roles: ["STUDENT"],
    steps: [
      { icon: CalendarDays, title: "Ma journée", text: "Le tableau de bord montre tes cours d'aujourd'hui, dans l'ordre, avec la salle.", href: "/espace" },
      { icon: NotebookPen, title: "Mes notes", text: "Dans « Ma scolarité », l'onglet « Notes » donne chaque note et ta moyenne provisoire du trimestre ou du semestre, selon ton établissement.", href: "/espace/suivi" },
      { icon: BookOpen, title: "Mes ressources", text: "Les fiches et vidéos de ta classe sont sur le tableau de bord. Chaque vidéo a sa transcription écrite." },
      { icon: Volume2, title: "Tout écouter", text: "Chaque carte a un bouton « Écouter ». La vitesse de la voix se règle dans « Préférences »." },
    ],
  },
  {
    key: "enseignant",
    title: "Je suis enseignant",
    audience: "Enseignants",
    roles: ["TEACHER"],
    steps: [
      { icon: ClipboardCheck, title: "Faire l'appel", text: "Dans « Présences », choisissez la classe et la demi-journée, puis marquez les absents et les retards.", href: "/espace/presences" },
      { icon: NotebookPen, title: "Saisir les notes", text: "Dans « Notes », ouvrez la fiche de la matière et saisissez les notes : les moyennes sont calculées automatiquement.", href: "/espace/notes" },
      { icon: Megaphone, title: "Publier une ressource", text: "Dans « Annonces et ressources », ajoutez une fiche. Une vidéo ou un audio doit avoir sa transcription écrite.", href: "/espace/contenus" },
      { icon: MessageCircle, title: "Échanger avec les familles", text: "Dans « Messagerie », écrivez à un parent. Il peut lire votre message ou l'écouter.", href: "/espace/messages" },
    ],
  },
  {
    key: "ecole",
    title: "Je dirige ou gère une école",
    audience: "Directions, secrétariats, comptabilité",
    roles: ["SCHOOL_DIRECTOR", "SECRETARY", "ACCOUNTANT"],
    steps: [
      { icon: Users, title: "Inscrire les élèves", text: "Dans « Élèves », inscrivez l'élève dans sa classe et rattachez ses parents par leur numéro de téléphone.", href: "/espace/eleves" },
      { icon: LayoutGrid, title: "Organiser les classes", text: "« Classes » fixe les enseignants, les matières et les coefficients ; « Emploi du temps », les horaires.", href: "/espace/classes" },
      { icon: FileText, title: "Publier les bulletins", text: "Dans « Bulletins », verrouillez les notes, vérifiez puis publiez. Les parents reçoivent une notification.", href: "/espace/bulletins" },
      { icon: Wallet, title: "Suivre les frais", text: "« Frais et paiements » regroupe les types de frais, les factures, les échéanciers et les paiements, avec leur reçu.", href: "/espace/frais" },
      { icon: Inbox, title: "Faire une demande", text: "Dans « Demandes », adressez une demande à la circonscription ou à la direction départementale et suivez la décision.", href: "/espace/demandes" },
    ],
  },
  {
    key: "ministere",
    title: "Je travaille au ministère ou dans ses services",
    audience: "Ministère, directions départementales, circonscriptions",
    roles: ["NATIONAL_ADMIN", "NATIONAL_ANALYST", "DEPARTMENT_DIRECTOR", "COMMUNE_INSPECTOR"],
    steps: [
      { icon: BarChart3, title: "Lire les statistiques", text: "« Statistiques » donne les effectifs, la part des filles, la réussite et les absences, du pays jusqu'à l'école.", href: "/espace/statistiques" },
      { icon: Landmark, title: "Suivre les établissements", text: "« Établissements » et « Territoire » listent les écoles de votre périmètre, commune par commune.", href: "/espace/etablissements" },
      { icon: Inbox, title: "Traiter les demandes", text: "Dans « Demandes », accordez ou refusez chaque demande avec une note que l'école reçoit.", href: "/espace/demandes" },
      { icon: ShieldCheck, title: "Gérer les droits", text: "« Rôles et droits » fixe ce que chaque rôle peut faire. Chaque changement est inscrit au journal d'activité.", href: "/espace/droits" },
    ],
  },
  {
    key: "partenaire",
    title: "Je représente un partenaire",
    audience: "ONG, partenaires techniques et financiers",
    roles: ["PARTNER"],
    steps: [
      { icon: BarChart3, title: "Consulter les indicateurs", text: "« Statistiques » présente des chiffres agrégés, sans aucune donnée personnelle.", href: "/espace/statistiques" },
      { icon: Megaphone, title: "Lire les annonces", text: "« Annonces et ressources » publie les communications du ministère.", href: "/espace/contenus" },
    ],
  },
];

export const FAQ: { icon: LucideIcon; q: string; a: string }[] = [
  {
    icon: Volume2,
    q: "Comment faire lire une page à voix haute ?",
    a: "Appuyez sur un bouton « Écouter », en haut de chaque page ou sur une carte, puis sur « Arrêter » pour couper. La voix, Siwis, est la même sur tous les appareils ; sans connexion, c'est celle de votre téléphone ou de votre ordinateur, et si aucune voix française n'y est installée, un message vous l'indique.",
  },
  {
    icon: Accessibility,
    q: "Comment agrandir le texte ou renforcer le contraste ?",
    a: "Touchez le bouton rond en bas à droite de l'écran, ou ouvrez « Préférences » dans le menu. Vous y réglez la taille du texte, le contraste élevé, le thème sombre et la vitesse de la voix. Les réglages restent enregistrés sur cet appareil.",
  },
  {
    icon: WifiOff,
    q: "Puis-je utiliser Classéo sans réseau ?",
    a: "Oui, en lecture. Les pages déjà ouvertes (tableau de bord, bulletins, notes, présences, emploi du temps) restent lisibles hors ligne, et un bandeau signale la coupure. Les modifications demandent le réseau.",
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
    a: "Oui. La touche Tab passe d'un élément à l'autre avec un cadre visible, le lien « Aller au contenu principal » vient en premier, et chaque page a des titres et des repères pour les lecteurs d'écran.",
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
