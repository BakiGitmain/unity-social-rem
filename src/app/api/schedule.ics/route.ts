import type { NextRequest } from "next/server";
import { getSchedule } from "@/lib/data";
import type { ClassEntry } from "@/lib/time/schedule";

/**
 * Weekly class schedule as an iCalendar file: one weekly-recurring event per class,
 * in Addis Ababa time (TZID=Africa/Addis_Ababa, EAT, UTC+3), so phone calendars show the right times.
 */

// Monday of the week the first events are anchored to; RRULE repeats them every week from there.
const ANCHOR_MONDAY = { y: 2026, m: 11, d: 9 };
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const pad = (n: number) => String(n).padStart(2, "0");

function localStamp(day: number, minutes: number) {
  const date = new Date(Date.UTC(ANCHOR_MONDAY.y, ANCHOR_MONDAY.m - 1, ANCHOR_MONDAY.d + day - 1));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
}

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** iCalendar lines must be folded at 75 octets (UTF-8 aware, never splitting a character). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

function event(e: ClassEntry, am: boolean): string[] {
  const subject = am ? e.subjectAm : e.subjectEn;
  const room = am ? `${e.roomAm} (${e.floor}ኛ ፎቅ)` : `${e.roomEn} (${ordinal(e.floor)} floor)`;
  const periods = am ? `ክፍለ ጊዜ ${e.periodStart}ኛ–${e.periodEnd}ኛ` : `Periods ${e.periodLabel}`;
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}@unitysocialrem.app`,
    "DTSTAMP:20261109T000000Z",
    `DTSTART;TZID=Africa/Addis_Ababa:${localStamp(e.day, e.start)}`,
    `DTEND;TZID=Africa/Addis_Ababa:${localStamp(e.day, e.end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[e.day - 1]}`,
    `SUMMARY:${escape(subject)}`,
    `LOCATION:${escape(room)}`,
    `DESCRIPTION:${escape(periods)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(subject)}`,
    "TRIGGER:-PT10M",
    "END:VALARM",
    "END:VEVENT",
  ];
}

export async function GET(request: NextRequest) {
  const am = request.nextUrl.searchParams.get("lang") === "am";
  const data = await getSchedule();
  const name = data ? (am ? data.section.name_am : data.section.name_en) : "Class schedule";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Unity Social Rem//Class Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    "X-WR-TIMEZONE:Africa/Addis_Ababa",
    "BEGIN:VTIMEZONE",
    "TZID:Africa/Addis_Ababa",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:EAT",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...(data?.entries ?? []).flatMap((e) => event(e, am)),
    "END:VCALENDAR",
  ];

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unity-social-rem-schedule.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
