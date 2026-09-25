import { CalendarClock, CheckCheck, Clock, HeartHandshake, PhoneCall, Thermometer, type LucideIcon } from "lucide-react";

// Ready made messages for parents who write little: one pictogram, one short
// sentence, one tap.
export const QUICK_MESSAGES: { id: string; text: string; subject: string; Icon: LucideIcon }[] = [
  { id: "sick", text: "Mon enfant est malade aujourd'hui.", subject: "Absence pour maladie", Icon: Thermometer },
  { id: "meeting", text: "Je souhaite un rendez-vous.", subject: "Demande de rendez-vous", Icon: CalendarClock },
  { id: "thanks", text: "Merci pour l'information.", subject: "Merci", Icon: HeartHandshake },
  { id: "late", text: "Mon enfant sera en retard aujourd'hui.", subject: "Retard", Icon: Clock },
  { id: "call", text: "Pouvez-vous m'appeler, s'il vous plaît ?", subject: "Demande d'appel", Icon: PhoneCall },
  { id: "received", text: "J'ai bien reçu votre message.", subject: "Message reçu", Icon: CheckCheck },
];
