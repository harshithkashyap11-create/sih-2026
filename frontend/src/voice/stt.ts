import type { SupportedLanguage } from "../shared/i18n";
export type VoiceLanguage = SupportedLanguage;
export const recognitionLocale = (language: VoiceLanguage): string =>
  ({
    en: "en-IN",
    as: "as-IN",
    bn: "bn-IN",
    hi: "hi-IN",
    te: "te-IN",
    mni: "mni-IN",
    lus: "lus-IN",
    brx: "brx-IN",
    kha: "kha-IN",
    grt: "grt-IN",
    ne: "ne-IN",
    trp: "trp-IN",
  })[language];
export interface SpeechToText {
  start(
    onResult: (text: string) => void,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void;
  stop(): void;
}
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
};

/** Assamese recognition is not consistently available in browser engines. */
const fallbackRecognitionLocale = (
  language: VoiceLanguage,
): string | undefined => (language === "as" ? "bn-IN" : undefined);

export class BrowserSpeechToText implements SpeechToText {
  private recognition?: Recognition;
  private timer?: number;
  private triedFallback = false;

  constructor(private language: VoiceLanguage) {}

  start(
    onResult: (text: string) => void,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void {
    this.stop();
    const browser = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Ctor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Ctor) {
      onError?.("unsupported");
      onEnd?.();
      return;
    }

    const begin = (locale: string): void => {
      let recognition: Recognition;
      try {
        recognition = new Ctor();
      } catch {
        onError?.("start-failed");
        onEnd?.();
        return;
      }
      this.recognition = recognition;
      recognition.lang = locale;
      recognition.interimResults = false;
      recognition.continuous = false;
      const resetSilenceTimer = (duration = 6_000): void => {
        this.clearTimer();
        this.timer = window.setTimeout(() => this.stop(), duration);
      };
      // Keep the idle timeout short, but allow a slow spoken reminder to finish.
      recognition.onspeechstart = () => {
        if (this.recognition === recognition) resetSilenceTimer(30_000);
      };
      recognition.onspeechend = () => {
        if (this.recognition === recognition) resetSilenceTimer();
      };
      recognition.onresult = (event) => {
        if (this.recognition !== recognition) return;
        const text = (event.results[0]?.[0]?.transcript ?? "").trim();
        if (text) onResult(text);
        if (this.recognition === recognition) resetSilenceTimer();
      };
      recognition.onerror = (event) => {
        if (this.recognition !== recognition) return;
        const fallback = fallbackRecognitionLocale(this.language);
        if (
          !this.triedFallback &&
          fallback &&
          event.error === "language-not-supported"
        ) {
          this.triedFallback = true;
          this.clearTimer();
          recognition.onend = null;
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onspeechstart = null;
          recognition.onspeechend = null;
          try {
            recognition.stop();
          } catch {
            /* Engine already ended. */
          }
          begin(fallback);
        } else {
          this.clearTimer();
          this.recognition = undefined;
          recognition.onend = null;
          onError?.(event.error);
          onEnd?.();
        }
      };
      recognition.onend = () => {
        if (this.recognition !== recognition) return;
        this.clearTimer();
        this.recognition = undefined;
        onEnd?.();
      };
      try {
        recognition.start();
        resetSilenceTimer();
      } catch {
        this.recognition = undefined;
        onError?.("start-failed");
        onEnd?.();
      }
    };

    this.triedFallback = false;
    begin(recognitionLocale(this.language));
  }

  stop(): void {
    this.clearTimer();
    const recognition = this.recognition;
    if (recognition) {
      const end = recognition.onend;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onspeechstart = null;
      recognition.onspeechend = null;
      try {
        recognition.stop();
      } catch {
        /* Already stopped by the browser. */
      }
      end?.();
      this.recognition = undefined;
    }
  }

  private clearTimer(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
export class FakeSpeechToText implements SpeechToText {
  active = false;
  private onResult?: (text: string) => void;
  private onEnd?: () => void;

  constructor(private text = "") {}

  start(onResult: (text: string) => void, onEnd?: () => void): void {
    this.active = true;
    this.onResult = onResult;
    this.onEnd = onEnd;
    if (this.text) onResult(this.text);
  }

  emit(text: string): void {
    if (this.active) this.onResult?.(text);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.onEnd?.();
  }
}
