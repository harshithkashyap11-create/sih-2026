import { useCalmStore } from "../features/patient/confused/store";
import { recognitionLocale, type VoiceLanguage } from "./stt";
export interface TextToSpeech {
  speak(text: string, options?: { slow?: boolean }): Promise<void>;
  cancel(): void;
}
const voiceFallbacks: Record<VoiceLanguage, readonly string[]> = {
  en: ["en-IN", "en"],
  as: ["as-IN", "as", "bn-IN", "bn"],
  bn: ["bn-IN", "bn"],
  hi: ["hi-IN", "hi"],
  te: ["te-IN", "te"],
  mni: ["mni-IN", "mni"],
  lus: ["lus-IN", "lus"],
  brx: ["brx-IN", "brx"],
  kha: ["kha-IN", "kha"],
  grt: ["grt-IN", "grt"],
  ne: ["ne-IN", "ne"],
  trp: ["trp-IN", "trp"],
};

export class BrowserTextToSpeech implements TextToSpeech {
  private generation = 0;
  private pending?: () => void;
  constructor(
    private language: VoiceLanguage,
    private slow = false,
  ) {}
  setSlow(slow: boolean): void {
    this.slow = slow;
  }
  async speak(text: string, options: { slow?: boolean } = {}): Promise<void> {
    this.cancel();
    if (!text.trim()) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const generation = this.generation;
    const locale = recognitionLocale(this.language);
    let voices: SpeechSynthesisVoice[];
    try {
      voices = speechSynthesis.getVoices();
    } catch {
      return;
    }
    const voice = voiceFallbacks[this.language]
      .map(
        (candidate) =>
          voices.find(
            (item) => item.lang.toLowerCase() === candidate.toLowerCase(),
          ) ??
          voices.find((item) =>
            item.lang.toLowerCase().startsWith(`${candidate.toLowerCase()}-`),
          ),
      )
      .find((item): item is SpeechSynthesisVoice => item !== undefined);
    const sentences = text.split(/(?<=[.।])\s*/).filter(Boolean);
    const isSlow =
      useCalmStore.getState().calmMode || (options.slow ?? this.slow);
    for (const [index, sentence] of sentences.entries()) {
      if (generation !== this.generation) return;
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = locale;
        utterance.voice = voice ?? null;
        utterance.rate = isSlow ? 0.7 : 0.95;
        utterance.pitch = 1;
        const finish = () => {
          window.clearTimeout(timeout);
          if (this.pending === finish) this.pending = undefined;
          resolve();
        };
        const timeout = window.setTimeout(
          () => {
            try {
              speechSynthesis.cancel();
            } catch {
              /* Provider unavailable. */
            }
            finish();
          },
          Math.max(10_000, sentence.length * 250),
        );
        this.pending = finish;
        utterance.onend = finish;
        utterance.onerror = finish;
        try {
          speechSynthesis.speak(utterance);
        } catch {
          finish();
        }
      });
      if (isSlow && index < sentences.length - 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
      }
    }
  }
  cancel(): void {
    this.generation++;
    this.pending?.();
    this.pending = undefined;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* Provider unavailable. */
    }
  }
}
export class FakeTextToSpeech implements TextToSpeech {
  spoken: Array<{ text: string; slow: boolean }> = [];
  speak(text: string, options: { slow?: boolean } = {}): Promise<void> {
    this.spoken.push({ text, slow: Boolean(options.slow) });
    return Promise.resolve();
  }
  cancel(): void {}
}
