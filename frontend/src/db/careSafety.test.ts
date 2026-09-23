import { expect, test } from "vitest";
import { dayInTimezone, careTime } from "./reminders";
import { isCurrentMedication } from "./repo/routine";
import { mediaIdentity } from "./media";
import { languageNames, supportedLanguages } from "../shared/i18n";

test("care clock and care day are independent of the device timezone", () => {
  const instant = new Date("2026-09-18T19:00:00Z");
  expect(dayInTimezone(instant)).toBe("2026-09-19");
  expect(careTime(instant)).toBe("00:30");
  expect(careTime(new Date("2026-03-08T02:30:00Z"))).toBe("08:00");
});

test("stopped, future and expired medicines are not current; date endpoints are inclusive", () => {
  const medicine = { id: "fixture", name: "Fixture", dose: "1", times: ["08:00"], instructions: "", active: true, start_date: "2026-09-18", end_date: "2026-09-18" };
  expect(isCurrentMedication(medicine, "2026-09-18")).toBe(true);
  expect(isCurrentMedication(medicine, "2026-09-17")).toBe(false);
  expect(isCurrentMedication(medicine, "2026-09-19")).toBe(false);
  expect(isCurrentMedication({ ...medicine, active: false }, "2026-09-18")).toBe(false);
});

test("media identity removes expiring credentials without merging object versions", () => {
  expect(mediaIdentity("https://example.test/photo?X-Amz-Signature=old&versionId=1"))
    .toBe(mediaIdentity("https://example.test/photo?X-Amz-Signature=new&versionId=1"));
  expect(mediaIdentity("https://example.test/photo?versionId=1"))
    .not.toBe(mediaIdentity("https://example.test/photo?versionId=2"));
});

test("northeastern language options have plain display names", () => {
  for (const language of ["as", "mni", "lus", "brx", "kha", "grt", "ne", "trp"] as const) {
    expect(supportedLanguages).toContain(language);
    expect(languageNames[language]).not.toMatch(/fallback/i);
  }
});
