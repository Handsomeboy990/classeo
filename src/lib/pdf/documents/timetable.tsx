import { View } from "@react-pdf/renderer";

import { DAYS, toMinutes } from "@/lib/domain/timetable";

import { mergeSimultaneous, placeSlots, weeklyMinutes, type WeekSlot } from "../week";

import { FONT_TITLE } from "../fonts";
import { calendarDate, duration } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { COLORS, styles } from "../theme";

// detail: the teacher for a class timetable, the class for a teacher's.
export type TimetableSlot = WeekSlot;

export type TimetableData = {
  who: string;
  kind: "class" | "teacher";
  yearLabel: string | null;
  monday: Date;
  saturday: Date;
  slots: TimetableSlot[];
};

// Tints for subjects, light enough for any printer, each with a darker edge.
const TINTS = [
  ["#e3f1e9", "#006b40"],
  ["#e5edff", "#1d4ed8"],
  ["#fff1d1", "#8a5a00"],
  ["#fde8eb", "#b3102a"],
  ["#e0f4f4", "#0f6b6b"],
  ["#efe7fb", "#6b3fb3"],
  ["#eef2dc", "#5b6b12"],
  ["#eceeee", "#3f4a4a"],
] as const;

function tintOf(subject: string, order: string[]) {
  return TINTS[order.indexOf(subject) % TINTS.length]!;
}

const GRID_HEIGHT = 322;
const TIME_COL = 34;

function WeekGrid({ data }: { data: TimetableData }) {
  const starts = data.slots.map((s) => toMinutes(s.startTime));
  const ends = data.slots.map((s) => toMinutes(s.endTime));
  const from = Math.floor(Math.min(...starts, 8 * 60) / 60) * 60;
  const to = Math.ceil(Math.max(...ends, 12 * 60) / 60) * 60;
  const perMinute = GRID_HEIGHT / (to - from);
  const hours: number[] = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const subjects = [...new Set(data.slots.map((s) => s.subject))].sort((a, b) => a.localeCompare(b, "fr"));
  const placed = placeSlots(mergeSimultaneous(data.slots));

  return (
    <View wrap={false}>
      <View style={{ flexDirection: "row", marginLeft: TIME_COL, borderBottomWidth: 1, borderBottomColor: COLORS.primary }}>
        {DAYS.map((d) => (
          <View key={d.value} style={{ flex: 1, paddingVertical: 4, backgroundColor: COLORS.primarySoft, borderLeftWidth: 0.5, borderLeftColor: COLORS.white }}>
            <T style={[styles.headCell, { textAlign: "center", paddingVertical: 0 }]}>{d.label}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", height: GRID_HEIGHT }}>
        <View style={{ width: TIME_COL, position: "relative" }}>
          {hours.map((m) => (
            <T key={m} style={{ position: "absolute", top: (m - from) * perMinute - 4, right: 5, fontSize: 7, color: COLORS.muted }}>
              {`${String(m / 60).padStart(2, "0")} h`}
            </T>
          ))}
        </View>
        {DAYS.map((d) => (
          <View key={d.value} style={{ flex: 1, position: "relative", borderLeftWidth: 0.5, borderLeftColor: COLORS.border, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
            {hours.slice(1, -1).map((m) => (
              <View key={m} style={{ position: "absolute", top: (m - from) * perMinute, left: 0, right: 0, borderTopWidth: 0.4, borderTopColor: COLORS.rule }} />
            ))}
            {placed
              .filter((s) => s.dayOfWeek === d.value)
              .map((s, i) => {
                const top = (toMinutes(s.startTime) - from) * perMinute;
                const height = (toMinutes(s.endTime) - toMinutes(s.startTime)) * perMinute;
                const [bg, edge] = tintOf(s.subject, subjects);
                // Estimated lines of the subject in a day column, to show the
                // teacher or class only where it fits without overlapping.
                const subjectLines = s.subject.length > 22 / s.lanes ? 2 : 1;
                const roomy = 4 + 8 + subjectLines * 9.5 + 8 <= height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: top + 1,
                      left: `${(s.lane / s.lanes) * 100}%`,
                      width: `${100 / s.lanes}%`,
                      height: height - 2,
                      borderRightWidth: 2,
                      borderRightColor: COLORS.white,
                      backgroundColor: s.cancelledOn ? COLORS.soft : bg,
                      borderLeftWidth: 2.5,
                      borderLeftColor: s.cancelledOn ? COLORS.faint : edge,
                      borderRadius: 2,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      overflow: "hidden",
                    }}
                  >
                    <T style={{ fontSize: 6.5, lineHeight: 1.2, color: COLORS.muted }}>
                      {s.startTime.replace(":", " h ")} à {s.endTime.replace(":", " h ")}
                      {s.room && !s.room.includes(", ") ? ` · ${s.room}` : ""}
                    </T>
                    <T style={{ fontSize: 7.8, lineHeight: 1.2, fontWeight: 700, color: s.cancelledOn ? COLORS.muted : COLORS.text }}>{s.subject}</T>
                    {roomy && s.detail ? <T style={{ fontSize: 6.8, lineHeight: 1.2, color: COLORS.muted }}>{s.detail}</T> : null}
                    {s.cancelledOn ? <T style={{ fontSize: 6.5, fontWeight: 700, color: COLORS.danger }}>Annulé cette semaine</T> : null}
                  </View>
                );
              })}
          </View>
        ))}
      </View>
    </View>
  );
}

function Summary({ data }: { data: TimetableData }) {
  const totals = weeklyMinutes(mergeSimultaneous(data.slots));
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  return (
    <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 10 }} wrap={false}>
      <T style={{ fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 8.5, color: COLORS.primaryDark }}>Volume hebdomadaire : {duration(all)}</T>
      {[...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([subject, minutes]) => (
          <T key={subject} style={{ fontSize: 7.5, color: COLORS.muted }}>
            {subject} {duration(minutes)}
          </T>
        ))}
    </View>
  );
}

export const timetablePdf = (data: TimetableData, meta: DocumentMeta) => (
  <PdfDocument title={`Emploi du temps, ${data.who}`} author={meta.issuer.name}>
    <DocumentPage
      meta={meta}
      orientation="landscape"
      header={
        <T style={[styles.small, styles.muted, { marginTop: 5 }]}>
          Semaine du {calendarDate(data.monday)} au {calendarDate(data.saturday)}
          {data.kind === "teacher" ? " · toutes les classes de l'enseignant" : ""}
        </T>
      }
    >
      {data.slots.length ? (
        <>
          <WeekGrid data={data} />
          <Summary data={data} />
        </>
      ) : (
        <T style={[styles.muted, { marginTop: 20, textAlign: "center" }]}>Aucun cours planifié.</T>
      )}
    </DocumentPage>
  </PdfDocument>
);
