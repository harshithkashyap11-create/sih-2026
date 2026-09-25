import { type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  HeartHandshake,
  Languages,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Type,
  UserRound,
  type LucideProps,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";

import { supportedLanguages, languageNames } from "../../shared/i18n";
import { motionTokens, springs } from "../../shared/motion/tokens";
import { useThemeStore } from "../../shared/theme/store";

type RoleOption = {
  icon: ComponentType<LucideProps>;
  labelKey:
    | "landing.patient"
    | "landing.caregiver"
    | "landing.doctor"
    | "landing.admin";
  route: string;
  tone: string;
};

const roleOptions: RoleOption[] = [
  {
    icon: UserRound,
    labelKey: "landing.patient",
    route: "/login/patient",
    tone: "bg-accent-light text-primary",
  },
  {
    icon: HeartHandshake,
    labelKey: "landing.caregiver",
    route: "/login/caregiver",
    tone: "bg-lavender text-primary",
  },
  {
    icon: Stethoscope,
    labelKey: "landing.doctor",
    route: "/login/doctor",
    tone: "bg-calm text-primary",
  },
  {
    icon: ShieldCheck,
    labelKey: "landing.admin",
    route: "/portal/admin",
    tone: "bg-surface-muted text-muted",
  },
];

export function LandingPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const cycleFontScale = useThemeStore((state) => state.cycleFontScale);
  const prefersReducedMotion = useReducedMotion();

  const entrance = (delay: number) => ({
    initial: prefersReducedMotion
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: motionTokens.distance.sm },
    animate: { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? { duration: motionTokens.duration.instant }
      : { ...springs.gentle, delay },
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg px-4 py-5 text-text sm:px-6 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full border border-border bg-calm opacity-50 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full border border-border bg-lavender opacity-40 blur-3xl" />
        <svg
          className="absolute right-[6%] top-16 hidden h-48 w-64 text-accent opacity-[0.12] lg:block"
          fill="none"
          viewBox="0 0 256 192"
        >
          <path
            d="M24 132C72 132 70 44 120 44s48 96 112 96"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M50 154c38-3 52-42 88-50 38-9 51 30 82 30"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="24" cy="132" fill="currentColor" r="5" />
          <circle cx="120" cy="44" fill="currentColor" r="7" />
          <circle cx="138" cy="104" fill="currentColor" r="4" />
          <circle cx="232" cy="140" fill="currentColor" r="6" />
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <motion.p
          {...entrance(0)}
          className="mx-auto mb-5 max-w-2xl rounded-full border border-border bg-surface px-4 py-2 text-center text-sm font-medium text-muted shadow-sm"
          role="note"
        >
          {t("localization.notice")}
        </motion.p>

        <div className="grid flex-1 items-center gap-7 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12">
          <motion.header
            {...entrance(0.05)}
            className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-border bg-surface shadow-card lg:mx-0">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-accent-light text-accent">
                <Sparkles aria-hidden="true" size={30} strokeWidth={1.8} />
                <span className="absolute -right-1 top-2 h-2.5 w-2.5 rounded-full bg-accent" />
                <span className="absolute bottom-2 left-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-[-0.04em] text-text sm:text-5xl">
              {t("app.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-muted lg:mx-0">
              {t("landing.tagline")}
            </p>
            <Link
              className="mt-6 inline-flex min-h-touch items-center justify-center gap-2 rounded-card bg-primary px-6 py-3 font-bold text-primary-text shadow-card hover:brightness-95 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-warn"
              to="/register"
            >
              {t("registration.create")}
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
          </motion.header>

          <motion.section
            {...entrance(0.1)}
            aria-labelledby="role-heading"
            className="rounded-[1.75rem] border border-border bg-surface p-4 shadow-card sm:p-6"
          >
            <div className="mb-5 flex items-center gap-3 px-1">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
                <UserRound aria-hidden="true" size={23} />
              </span>
              <h2
                id="role-heading"
                className="text-xl font-bold leading-tight sm:text-2xl"
              >
                {t("landing.chooseRole")}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {roleOptions.map(({ icon: Icon, labelKey, route, tone }) => (
                <motion.button
                  className="group flex min-h-touch w-full items-center gap-4 rounded-card border border-border bg-surface px-4 py-4 text-left font-bold text-text shadow-sm hover:border-accent hover:bg-surface-muted"
                  key={route}
                  onClick={() => void navigate(route)}
                  transition={springs.snappy}
                  type="button"
                  whileTap={
                    prefersReducedMotion
                      ? undefined
                      : { scale: motionTokens.scale.press }
                  }
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}
                  >
                    <Icon aria-hidden="true" size={25} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    {t(labelKey)}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="shrink-0 text-muted transition-transform motion-safe:group-hover:translate-x-1"
                    size={19}
                  />
                </motion.button>
              ))}
            </div>
          </motion.section>
        </div>

        <motion.section
          {...entrance(0.15)}
          aria-labelledby="settings-heading"
          className="mt-7 rounded-[1.75rem] border border-border p-4 shadow-card backdrop-blur-xl sm:p-5 [background:color-mix(in_srgb,var(--surface)_88%,transparent)]"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <Languages
                  aria-hidden="true"
                  className="text-accent"
                  size={21}
                />
                <h2 id="settings-heading" className="font-bold">
                  {t("landing.language")}
                </h2>
              </div>
              <div
                aria-label={t("landing.language")}
                className="flex flex-wrap gap-2"
                role="group"
              >
                {supportedLanguages.map((language) => {
                  const selected = i18n.language.split("-")[0] === language;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-h-touch rounded-xl border px-3 py-2 text-sm font-semibold sm:py-2.5 ${
                        selected
                          ? "border-accent bg-accent-light text-text shadow-sm"
                          : "border-border bg-surface text-text hover:border-accent hover:bg-surface-muted"
                      }`}
                      key={language}
                      onClick={() => void i18n.changeLanguage(language)}
                      type="button"
                    >
                      {languageNames[language]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              aria-label={t("landing.settings")}
              className="grid shrink-0 gap-2 sm:grid-cols-2"
              role="group"
            >
              <motion.button
                className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 font-semibold text-text hover:border-accent hover:bg-surface-muted"
                onClick={toggleTheme}
                transition={springs.snappy}
                type="button"
                whileTap={
                  prefersReducedMotion
                    ? undefined
                    : { scale: motionTokens.scale.press }
                }
              >
                <MoonStar
                  aria-hidden="true"
                  className="text-accent"
                  size={20}
                />
                {t("landing.theme")}
              </motion.button>
              <motion.button
                className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 font-semibold text-text hover:border-accent hover:bg-surface-muted"
                onClick={cycleFontScale}
                transition={springs.snappy}
                type="button"
                whileTap={
                  prefersReducedMotion
                    ? undefined
                    : { scale: motionTokens.scale.press }
                }
              >
                <Type aria-hidden="true" className="text-accent" size={20} />
                {t("landing.textSize")}
              </motion.button>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
