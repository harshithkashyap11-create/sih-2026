import { db, type CachedRoutineItem } from "./schema";

const namespace = "c64f5d1d63d54b1f98525e6437b78a30";
export const CARE_TIMEZONE = "Asia/Kolkata";
const timezone = CARE_TIMEZONE;
export function careTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
export function dayInTimezone(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
// UUID v5 uses SHA-1 (RFC 9562), including the namespace bytes before the name.
// This synchronous implementation can run inside an IndexedDB transaction.
export function reminderIdFor(ruleId: string, day: string): string {
  const input = [
    ...namespace.match(/../g)!.map((x) => parseInt(x, 16)),
    ...new TextEncoder().encode(`${ruleId}:${day}`),
  ];
  const bitLength = input.length * 8;
  input.push(128);
  while (input.length % 64 !== 56) input.push(0);
  input.push(
    0,
    0,
    0,
    0,
    (bitLength >>> 24) & 255,
    (bitLength >>> 16) & 255,
    (bitLength >>> 8) & 255,
    bitLength & 255,
  );
  let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const rotate = (x: number, bits: number) => (x << bits) | (x >>> (32 - bits));
  for (let offset = 0; offset < input.length; offset += 64) {
    const w = Array<number>(80).fill(0);
    for (let i = 0; i < 16; i++)
      w[i] =
        (input[offset + i * 4]! << 24) |
        (input[offset + i * 4 + 1]! << 16) |
        (input[offset + i * 4 + 2]! << 8) |
        input[offset + i * 4 + 3]!;
    for (let i = 16; i < 80; i++)
      w[i] = rotate(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let i = 0; i < 80; i++) {
      const f =
        i < 20
          ? (b & c) | (~b & d)
          : i < 40
            ? b ^ c ^ d
            : i < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k =
        i < 20
          ? 0x5a827999
          : i < 40
            ? 0x6ed9eba1
            : i < 60
              ? 0x8f1bbcdc
              : 0xca62c1d6;
      const next = (rotate(a, 5) + f + e + k + w[i]!) | 0;
      e = d;
      d = c;
      c = rotate(b, 30);
      b = a;
      a = next;
    }
    h = h.map((x, i) => (x + [a, b, c, d, e][i]!) | 0);
  }
  const bytes = h
    .flatMap((x) => [
      (x >>> 24) & 255,
      (x >>> 16) & 255,
      (x >>> 8) & 255,
      x & 255,
    ])
    .slice(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function scheduledFor(
  rule: CachedRoutineItem,
  day: string,
): string | null {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  if (
    !rule.start_date ||
    !rule.days_of_week?.includes(weekday) ||
    day < rule.start_date ||
    (rule.end_date && day > rule.end_date)
  )
    return null;
  return new Date(`${day}T${rule.time_of_day}+05:30`).toISOString();
}
export async function generateLocalReminders(
  patientId: string,
  day = dayInTimezone(),
): Promise<void> {
  const rules = await db.routineItems
    .where("patientId")
    .equals(patientId)
    .toArray();
  await db.transaction("rw", db.reminders, db.reminderResponses, async () => {
    for (const rule of rules) {
      const scheduled_at = scheduledFor(rule, day);
      const id = reminderIdFor(rule.id, day);
      const existing = await db.reminders.get(id);
      const mutable =
        existing?.status === "pending" &&
        new Date(existing.scheduled_at).getTime() >= Date.now() &&
        !(await db.reminderResponses.where("reminderId").equals(id).count());
      if (!scheduled_at && mutable) {
        await db.reminders.delete(id);
      } else if (scheduled_at && (!existing || mutable))
        await db.reminders.put({
          id,
          patientId,
          title: rule.title,
          category: rule.category,
          note: rule.note ?? "",
          scheduled_at,
          status: "pending",
          snoozed_until: null,
        });
    }
  });
}
