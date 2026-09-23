import type { VoiceLanguage } from "./stt";
import { recognizeGame } from "./gameContract";
import { isNegatedCommand } from "./safety";
import {
  parseReminderRequest,
  completeReminder,
  parseReminderTime,
} from "./reminderParser";
export { parseReminderTime } from "./reminderParser";
export type Intent =
  | "open_section"
  | "start_game"
  | "medicines_today"
  | "next_activity"
  | "set_reminder"
  | "call_person"
  | "read_this"
  | "speak_slowly"
  | "speak_normally"
  | "help"
  | "sos"
  | "switch_language"
  | "stop_listening"
  | "stop_game"
  | "time_query"
  | "date_query"
  | "general_chat"
  | "repeat"
  | "cancel"
  | "medication_status"
  | "get_reminders"
  | "get_schedule"
  | "repeat_instructions"
  | "request_hint";
export interface FamilyContext {
  familyMembers?: Array<{ name: string; relationship?: string }>;
  languageLocked?: boolean;
}
export interface RoutedIntent {
  intent: Intent;
  slots: Record<string, string>;
  requiresConfirm: boolean;
  source?: "RULE" | "LOCAL_LLM" | "CLOUD_LLM";
  confidence?: number;
}
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}: ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const reminderTime = (value: string): string | null => {
  const [hour, minute = "00"] = value.split(":");
  if (Number(hour) > 23 || Number(minute) > 59) return null;
  return `${hour!.padStart(2, "0")}:${minute}`;
};
const distance = (a: string, b: string): number => {
  const row = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j] ?? j;
      row[j] = Math.min(
        old + 1,
        (row[j - 1] ?? j) + 1,
        prev + Number(a.charAt(i - 1) !== b.charAt(j - 1)),
      );
      prev = old;
    }
  }
  return row[b.length] ?? 0;
};
export const isLanguageSwitchRequest = (utterance: string): boolean =>
  /(?:भाषा|हिन्दी|हिंदी|अंग्रेज़ी|बंगाली|असमिया|स्पेनिश).*(?:बदल|करो)|(?:बदल).*(?:भाषा|हिन्दी|हिंदी)|(?:cambia|cambiar).*(?:idioma|español|inglés|hindi|bengalí|asamés)/u.test(
    normalize(utterance),
  ) ||
  /(switch|change).*(language|bengali|assamese|english|hindi|telugu|manipuri|meitei|mizo)|(?:ভাষা|বাংলা|অসমীয়া|ইংৰাজী|ইংরেজি).*(?:সলনি|বদল)|(?:সলনি|বদল).*(?:ভাষা|বাংলা|অসমীয়া|ইংৰাজী|ইংরেজি)/u.test(
    normalize(utterance),
  );
export function route(
  utterance: string,
  _language: VoiceLanguage,
  context: FamilyContext = {},
): RoutedIntent | null {
  const text = normalize(utterance).replace(
    /^(?:hey |hi |okay |ok )?sm[aā]rana\s*/u,
    "",
  );
  const make = (
    intent: Intent,
    slots: Record<string, string> = {},
    confirm = false,
  ): RoutedIntent => ({ intent, slots, requiresConfirm: confirm });
  // Priority: targeted negation/cancel -> emergency -> stop/repeat -> reminder
  // -> longest game alias -> schedule/progress/navigation -> help -> conversation.
  if (isNegatedCommand(utterance)) return make("cancel");
  if (/^(?:cancel|never mind|cancel (?:the |my )?reminder)$/u.test(text))
    return make("cancel");
  if (/(?:emergency|need help now|জৰুৰী|জরুরি|आपातकाल|emergencia)/u.test(text))
    return make("sos", {}, true);
  if (
    /^(?:repeat(?: that)?|say that again|can you repeat(?: that)?)$/u.test(text)
  )
    return make("repeat");
  if (
    /^(?:stop playing|exit (?:this|the) activity|leave (?:this|the) game)$/u.test(
      text,
    )
  )
    return make("stop_game");
  if (
    /^(?:repeat(?: the)? instructions|read(?: the)? instructions|say(?: the)? instructions again)$/u.test(
      text,
    )
  )
    return make("repeat_instructions");
  if (
    /^(?:give me (?:a )?hint|show (?:me )?(?:a )?hint|hint|help me with (?:this|the) game)$/u.test(
      text,
    )
  )
    return make("request_hint");
  if (
    /^(?:what reminders (?:do i have|are there)|what are my reminders|read my reminders)$/u.test(
      text,
    )
  )
    return make("get_reminders");
  if (
    /^(?:what(?: s| is) my schedule(?: today)?|read my schedule)$/u.test(text)
  )
    return make("get_schedule");
  const reminder = parseReminderRequest(utterance);
  if (reminder.kind !== "none") {
    if (reminder.kind === "draft") {
      const completed = completeReminder(reminder.draft);
      if (completed.slots) return make("set_reminder", completed.slots, true);
    }
    return null; // Missing reminder entities cannot fall through into other actions.
  }
  const named = recognizeGame(text);
  if (named && /\b(?:play|start|open|do|try)\b|খেল|খেলা|শুরু/u.test(text))
    return make("start_game", { game: named.id });
  if (
    /^(?:let s play(?: a)?(?: game)?|i want a game|can we play(?: something| a game)?|open a brain game|play a game|start a game)$/u.test(
      text,
    )
  )
    return make("start_game");
  if (/^(?:খেলা খেলোঁ|খেলা খেলি)$/u.test(text)) return make("start_game");
  if (
    /^(?:what do i have today|what is my schedule today|what s my schedule today|i don t remember my schedule)$/u.test(
      text,
    ) ||
    /(?:open|show|view|take me to|go to) (?:my |the )?(?:schedule|daily schedule)/u.test(
      text,
    )
  )
    return make("open_section", { section: "routine" });
  if (
    /^(?:how am i doing|how have i been doing)$/u.test(text) ||
    /(?:show|open|view) (?:my |the )?results/u.test(text)
  )
    return make("open_section", { section: "progress" });
  if (
    /\b(?:taken|skipped|did i take|have i taken|today s medicines|medicines today)\b/u.test(
      text,
    )
  )
    return make("medication_status");
  if (/^(?:what can you do|what can you help me with)$/u.test(text))
    return make("help");
  if (/^(?:stop listening|goodbye|exit|quit)$/u.test(text))
    return make("stop_listening");
  if (/^(?:stop|end|exit|quit|close) (?:this |the |my )?game$/u.test(text))
    return make("stop_game");
  if (/what(?: s| is)? (?:the )?time|current time/u.test(text))
    return make("time_query");
  if (/what(?: s| is)? (?:the )?date|today s date/u.test(text))
    return make("date_query");
  const navigation = text.match(
    /(?:open|show|go(?: to)?|take me to|take me) (?:my |the |your )?(home|dashboard|patient dashboard|games|reminders|profile|progress|caregiver(?: details)?|settings|routine|memories|medicines|people)/u,
  );
  if (navigation?.[1])
    return make("open_section", {
      section:
        (
          {
            "patient dashboard": "home",
            dashboard: "home",
            "caregiver details": "caregiver",
          } as Record<string, string>
        )[navigation[1]] ?? navigation[1],
    });
  const englishReminder = text.match(
    /remind me(?: to (.+?))? at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/u,
  );
  if (englishReminder?.[1] && englishReminder[2]) {
    const time = parseReminderTime(englishReminder[2]);
    return time
      ? make("set_reminder", { title: englishReminder[1], time }, true)
      : null;
  }
  if (isLanguageSwitchRequest(text)) {
    if (context.languageLocked) return null;
    const choices: Array<[RegExp, VoiceLanguage]> = [
      [/(?:bengali|বাংলা|बंगाली|bengalí)/u, "bn"],
      [/(?:assamese|অসমীয়া|असमिया|asamés)/u, "as"],
      [/(?:hindi|हिन्दी|हिंदी)/u, "hi"],
      [/(?:telugu|తెలుగు)/u, "te"],
      [/(?:manipuri|meitei)/u, "mni"],
      [/(?:mizo)/u, "lus"],
      [/(?:bodo|बड़ो)/u, "brx"],
      [/(?:khasi)/u, "kha"],
      [/(?:garo)/u, "grt"],
      [/(?:nepali|नेपाली)/u, "ne"],
      [/(?:kokborok)/u, "trp"],
      [/(?:english|ইংৰাজী|ইংরেজি|अंग्रेज़ी|inglés)/u, "en"],
    ];
    const selected = choices.find(([pattern]) => pattern.test(text));
    return selected ? make("switch_language", { language: selected[1] }) : null;
  }
  const nativeSections: Array<[RegExp, string]> = [
    [/(?:यादें|यादों|recuerdos)/u, "memories"],
    [/(?:दवा|दवाइयाँ|दवाइयां|medicamentos|medicinas)/u, "medicines"],
    [/(?:दिनचर्या|rutina)/u, "routine"],
    [/(?:खेल|juegos)/u, "games"],
    [/(?:शांति|calma)/u, "calm-time"],
    [/(?:परिवार|लोग|familia|personas)/u, "people"],
    [/(?:सेटिंग्स|ajustes|configuración)/u, "settings"],
    [/(?:प्रगति|progreso)/u, "progress"],
  ];
  const nativeSection = nativeSections.find(([pattern]) => pattern.test(text));
  if (nativeSection && /(?:खोल|दिखा|जाओ|abre|abrir|muestra|ir a)/u.test(text))
    return make("open_section", { section: nativeSection[1] });
  if (/(?:आपातकाल|emergencia)/u.test(text)) return make("sos", {}, true);
  if (/(?:मदद|उलझन|ayuda|confundido|confundida)/u.test(text))
    return make("help");
  if (/(?:धीरे बोल|habla despacio|hablar despacio)/u.test(text))
    return make("speak_slowly");
  if (/(?:सामान्य गति|सामान्य बोल|velocidad normal|habla normal)/u.test(text))
    return make("speak_normally");
  if (/(?:पढ़|lee esto|leer esto)/u.test(text)) return make("read_this");
  if (
    /(?:अगला|आगे क्या|qué sigue|siguiente actividad|qué día|qué hora)/u.test(
      text,
    )
  )
    return make("next_activity");
  if (/(?:दवा|दवाइयाँ|medicamentos|medicinas)/u.test(text))
    return make("medicines_today");
  const nativeReminder =
    text.match(
      /(?:recuérdame|recuerdame) (?:que |a )?(.+?) a las ([0-9]{1,2}(?::[0-9]{2})?)/u,
    ) ??
    text.match(/(.+?) (?:के लिए )?([0-9]{1,2}(?::[0-9]{2})?) बजे याद दिला/u);
  if (nativeReminder?.[1] && nativeReminder[2]) {
    const time = reminderTime(nativeReminder[2]);
    return time
      ? make("set_reminder", { title: nativeReminder[1], time }, true)
      : null;
  }
  const nativeCall = text.match(
    /(?:llama a|llamar a) (.+)|(.+?) (?:को (?:फ़ोन|फोन|कॉल) करो)/u,
  );
  if (nativeCall) {
    const wanted = nativeCall[1] ?? nativeCall[2] ?? "";
    const person = context.familyMembers?.find(
      (member) =>
        normalize(member.name) === wanted ||
        normalize(member.relationship ?? "") === wanted,
    );
    if (person) return make("call_person", { name: person.name }, true);
  }
  if (/(?:खेल शुरू|खेलो|jugar|inicia un juego)/u.test(text))
    return make("start_game");
  if (/^(help|i am confused|i m confused|সহায়|সাহায্য)/u.test(text))
    return make("help");
  if (/(emergency|need help now|জৰুৰী|জরুরি)/u.test(text))
    return make("sos", {}, true);
  if (/(speak slowly|ধীরে|লাহে)/u.test(text)) return make("speak_slowly");
  if (/(speak normally|normal speed)/u.test(text))
    return make("speak_normally");
  if (/(read this|পঢ়ি|পড়ে)/u.test(text)) return make("read_this");
  const section = text.match(
    /(?:open|show|go to) (?:my )?(memories|medicines|routine|games|calm time|people|settings)/u,
  );
  if (section?.[1])
    return make("open_section", { section: section[1].replace(" ", "-") });
  const regionalSection: Array<[RegExp, string]> = [
    [/(?:স্মৃতি|স্মৃতিবোৰ|মেমোরি)/u, "memories"],
    [/(?:ঔষধ|ওষুধ)/u, "medicines"],
    [/(?:খেলা|খেল|গেম)/u, "games"],
    [/(?:ছেটিংছ|সেটিংস)/u, "settings"],
  ];
  const requestedSection = regionalSection.find(([pattern]) =>
    pattern.test(text),
  );
  if (requestedSection && /(?:খোল|খুল|দেখ|যাও|যান)/u.test(text))
    return make("open_section", { section: requestedSection[1] });
  if (/(what.*medicine|my medicine|tablet|ঔষধ)/u.test(text))
    return make("medicines_today");
  if (/(what ?s next|what time|what day|পৰৱৰ্তী|পরবর্তী)/u.test(text))
    return make("next_activity");
  const legacyReminder = text.match(
    /remind me to (.+?) at ([0-9]{1,2}(?::[0-9]{2})?)/u,
  );
  if (legacyReminder?.[1] && legacyReminder[2]) {
    const time = reminderTime(legacyReminder[2]);
    return time
      ? make("set_reminder", { title: legacyReminder[1], time }, true)
      : null;
  }
  const regionalReminder = text.match(
    /(?:মনত পেল|মনে কর).+? (.+?) (?:at|বজাত|টায়) ([0-9]{1,2}(?::[0-9]{2})?)/u,
  );
  if (regionalReminder?.[1] && regionalReminder[2]) {
    const time = reminderTime(regionalReminder[2]);
    return time
      ? make("set_reminder", { title: regionalReminder[1], time }, true)
      : null;
  }
  const call = text.match(
    /(?:call|phone|ফোন কৰক|ফোন কর|কল কৰক|কল কর) (?:my )?(.+)/u,
  );
  if (call?.[1]) {
    const wanted = call[1];
    const person = context.familyMembers?.find((p) =>
      [p.name, p.relationship ?? ""].some(
        (x) =>
          distance(normalize(x), wanted) / Math.max(x.length, wanted.length) <=
          0.3,
      ),
    );
    if (person) return make("call_person", { name: person.name }, true);
  }
  if (
    /^(?:why\b|what is\b|explain\b|tell me\b|how do\b|what does\b|what should i do now)/u.test(
      text,
    )
  )
    return make("general_chat");
  return null;
}
