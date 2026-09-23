import { i18n, supportedLanguages, type SupportedLanguage } from "../shared/i18n";
import { dayInTimezone } from "../db/reminders";
import type { NavigateFunction, To, NavigateOptions } from "react-router-dom";
import { db } from "../db/schema";
import { createOutboxEntry } from "../db/outbox";
import type { RoutineRepository } from "../db/repo/routine";
import type { RoutedIntent } from "./router";
import type { TextToSpeech } from "./tts";
import { gameKeysAllowed, sectionRoutes } from "./registry";
import { voiceGames } from "./gameContract";
import { gameInstructions, requestGameHint } from "./gameControls";
export interface ActionContext {
  navigate: NavigateFunction;
  tts: TextToSpeech;
  routine: RoutineRepository;
  patientId: string;
  confirm: (message: string, action: () => void | Promise<void>) => void;
  mainText?: string;
  nextActivity?: () => Promise<string>;
  callPerson?: (name: string) => void;
  openSos?: () => void;
  setSlowSpeech?: (slow: boolean) => Promise<void>;
  signal?: AbortSignal;
  isActive?: () => boolean;
}
export async function performAction(
  command: RoutedIntent,
  context: ActionContext,
): Promise<void> {
  const check = () => {
    if (context.signal?.aborted || context.isActive?.() === false)
      throw new DOMException("Turn cancelled", "AbortError");
  };
  const original = context;
  function guardedNavigate(
    to: To,
    options?: NavigateOptions,
  ): void | Promise<void>;
  function guardedNavigate(delta: number): void | Promise<void>;
  function guardedNavigate(
    to: To | number,
    options?: NavigateOptions,
  ): void | Promise<void> {
    check();
    return typeof to === "number"
      ? original.navigate(to)
      : options
        ? original.navigate(to, options)
        : original.navigate(to);
  }
  // Guard every externally visible effect, including callbacks after awaits.
  context = {
    ...original,
    navigate: guardedNavigate,
    tts: {
      cancel: () => original.tts.cancel(),
      speak: async (text, options) => {
        check();
        await original.tts.speak(text, options);
        check();
      },
    },
    confirm: (message, action) => {
      check();
      original.confirm(message, async () => {
        check();
        await action();
        check();
      });
    },
  };
  check();
  if (
    command.source &&
    command.source !== "RULE" &&
    command.intent !== "general_chat"
  )
    throw new Error("Models cannot execute application commands");
  if (command.intent === "switch_language") {
    const { i18n } = await import("../shared/i18n");
    const { getMeta } = await import("../db/schema");
    if (
      (await getMeta("languageLocked")) !== "1" &&
      supportedLanguages.includes(
        (command.slots.language ?? "") as SupportedLanguage,
      )
    ) {
      check();
      await i18n.changeLanguage(command.slots.language);
    }
    return;
  }
  if (command.intent === "open_section") {
    const section = command.slots.section ?? "";
    const target = Object.hasOwn(sectionRoutes, section)
      ? sectionRoutes[section]
      : undefined;
    if (!target) throw new Error("Unsupported section");
    void context.navigate(target);
    await context.tts.speak(`Opening ${command.slots.section}.`);
    return;
  }
  if (command.intent === "start_game") {
    if (command.slots.game && !gameKeysAllowed.has(command.slots.game))
      throw new Error("Unsupported game");
    void context.navigate(
      command.slots.game
        ? voiceGames.find((game) => game.id === command.slots.game)!.route
        : "/patient/games",
    );
    await context.tts.speak(
      command.slots.game ? "Starting your game." : "Opening your games.",
    );
    return;
  }
  if (command.intent === "stop_game") {
    void context.navigate("/patient/games");
    await context.tts.speak("Leaving the game.");
    return;
  }
  if (command.intent === "repeat_instructions") {
    await context.tts.speak(
      gameInstructions() ?? i18n.t("voice.noGameInstructions"),
    );
    return;
  }
  if (command.intent === "request_hint") {
    check();
    await context.tts.speak(
      i18n.t(requestGameHint() ? "voice.hintShown" : "voice.hintUnavailable"),
    );
    return;
  }
  if (command.intent === "get_reminders" || command.intent === "get_schedule") {
    const reminders = await context.routine.getToday();
    check();
    void context.navigate("/patient/routine");
    await context.tts.speak(
      reminders.length
        ? reminders
            .slice(0, 4)
            .map((item) => item.title)
            .join(". ")
        : i18n.t("voice.noReminders"),
    );
    return;
  }
  if (command.intent === "time_query" || command.intent === "date_query") {
    await context.tts.speak(
      command.intent === "time_query"
        ? new Date().toLocaleTimeString()
        : new Date().toLocaleDateString(),
    );
    return;
  }
  if (command.intent === "general_chat") {
    await context.tts.speak(
      command.slots.response ?? "Please try another request.",
    );
    return;
  }
  if (command.intent === "medicines_today") {
    check();
    const meds = await context.routine.getMedications();
    await context.tts.speak(
      meds.length
        ? "Your medication list: " +
            i18n.t("voice.medicines", {
              medicines: meds.map((x) => `${x.name}, ${x.dose}`).join(". "),
            })
        : i18n.t("voice.noMedicines"),
    );
    return;
  }
  if (command.intent === "medication_status") {
    check();
    const reminders = await context.routine.getToday();
    check();
    const medicines = reminders.filter(
      (item) => item.category === "medicine" || item.category === "medication",
    );
    await context.tts.speak(
      medicines.length
        ? "Today's medicine reminders: " +
            medicines.map((item) => item.title + ", " + item.status).join(". ")
        : "There are no medicine reminders in today's schedule. Your medication list may contain other medicines.",
    );
    return;
  }
  if (command.intent === "read_this") {
    await context.tts.speak(context.mainText ?? "");
    return;
  }
  if (command.intent === "next_activity") {
    await context.tts.speak(
      (await context.nextActivity?.()) ?? i18n.t("voice.homeTogether"),
    );
    return;
  }
  if (
    command.intent === "speak_slowly" ||
    command.intent === "speak_normally"
  ) {
    const slow = command.intent === "speak_slowly";
    check();
    await context.setSlowSpeech?.(slow);
    await context.tts.speak(
      slow ? i18n.t("voice.slower") : i18n.t("voice.normal"),
    );
    return;
  }
  if (command.intent === "help") {
    void context.navigate("/patient");
    await context.tts.speak(
      "You can ask me to open games, show reminders, read this page, or tell you the time. Say stop listening to finish.",
    );
    return;
  }
  if (command.intent === "call_person") {
    const name = command.slots.name ?? i18n.t("voice.familyMember");
    const message = i18n.t("voice.call", { name });
    await context.tts.speak(message);
    context.confirm(message, () => context.callPerson?.(name));
    return;
  }
  if (command.intent === "sos") {
    const message = i18n.t("voice.emergency");
    await context.tts.speak(message);
    context.confirm(message, () => context.openSos?.());
    return;
  }
  if (command.intent === "set_reminder") {
    if (
      !command.slots.title?.trim() ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(command.slots.time ?? "")
    )
      throw new Error("Invalid reminder");
    const id = crypto.randomUUID();
    const day = command.slots.date ?? dayInTimezone();
    const daily = command.slots.recurrence === "daily";
    if (command.slots.recurrence && !daily)
      throw new Error("Unsupported recurrence");
    if (command.slots.timezone && command.slots.timezone !== "Asia/Kolkata")
      throw new Error("Unsupported timezone");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      Number.isNaN(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      throw new Error("Invalid reminder date");
    if (
      !daily &&
      Date.parse(`${day}T${command.slots.time}:00+05:30`) <= Date.now()
    )
      throw new Error("Reminder must be in the future");
    const payload = {
      id,
      patient_id: context.patientId,
      title: command.slots.title,
      time_of_day: command.slots.time,
      start_date: day,
      end_date: daily ? null : day,
      category: "custom",
      days_of_week: daily
        ? [0, 1, 2, 3, 4, 5, 6]
        : [(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7],
      source: "patient",
      device_updated_at: new Date().toISOString(),
    };
    const dateLabel = new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(day + "T00:00:00+05:30"));
    const timeLabel = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(`${day}T${command.slots.time}:00+05:30`));
    const message = `Shall I remind you to ${command.slots.title.trim()} ${daily ? "every day" : "on " + dateLabel} at ${timeLabel}, India time?`;
    await context.tts.speak(message);
    context.confirm(message, async () => {
      check();
      await db.transaction(
        "rw",
        db.routineItems,
        db.outbox,
        async (transaction) => {
          const abort = () => transaction?.abort();
          context.signal?.addEventListener("abort", abort, { once: true });
          try {
            check();
            await db.routineItems.put({
              id,
              patientId: context.patientId,
              title: command.slots.title ?? "Reminder",
              category: "custom",
              time_of_day: command.slots.time ?? "09:00",
              days_of_week: payload.days_of_week,
              start_date: day,
              end_date: payload.end_date,
            });
            check();
            await db.outbox.put(
              createOutboxEntry("routine_item", id, context.patientId, payload),
            );
            check();
          } finally {
            context.signal?.removeEventListener("abort", abort);
          }
        },
      );
      check();
      await context.tts.speak("Your reminder is saved.");
    });
  }
}
