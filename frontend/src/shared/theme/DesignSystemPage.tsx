import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Heart,
  Mail,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { BigButton, Card, IconButton, StatusBadge, TextField } from "../ui";

const swatches = [
  ["Primary green", "#28785D", "var(--primary)"],
  ["Soft green", "#DDEFE5", "var(--calm)"],
  ["Sunrise", "#F39A55", "var(--accent)"],
  ["Sunrise tint", "#FBE5D1", "var(--accent-light)"],
  ["Warm ivory", "#FAF8F3", "var(--bg)"],
  ["Deep navy", "#16243D", "var(--text)"],
  ["Memory violet", "#E9E3F6", "var(--lavender)"],
  ["Recall blue", "#4382C3", "var(--color-chart-recall)"],
];
const tabs = ["Overview", "Activity", "Care team"] as const;

function Section({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={title.toLowerCase().replaceAll(" ", "-")}
      className="grid gap-5 border-t border-border pt-8"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h2
          className="mt-1 text-2xl font-bold tracking-tight text-text"
          id={title.toLowerCase().replaceAll(" ", "-")}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemPage() {
  const [selectedTab, setSelectedTab] = useState("Overview");
  const [enabled, setEnabled] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [notice, setNotice] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.indexOf(selectedTab as (typeof tabs)[number]);
    const next =
      event.key === "ArrowRight"
        ? (current + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (current + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : current;
    if (next === current) return;
    const label = tabs[next];
    if (!label) return;
    event.preventDefault();
    setSelectedTab(label);
    requestAnimationFrame(() =>
      document
        .getElementById(`ds-tab-${label.toLowerCase().replaceAll(" ", "-")}`)
        ?.focus(),
    );
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showDialog && !dialog.open) dialog.showModal();
    if (!showDialog && dialog.open) dialog.close();
  }, [showDialog]);

  return (
    <main className="min-h-screen bg-bg px-4 py-8 text-text sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-10">
        <header className="surface-elevated relative overflow-hidden p-6 sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-16 h-64 w-64 rounded-full bg-calm/80 blur-3xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
                SMĀRANA · M1
              </p>
              <h1 className="font-display mt-3 text-4xl leading-tight text-text sm:text-5xl">
                A calmer language for care.
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                The shared visual foundation for memory, connection, and
                brighter days.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-pill border border-primary/15 bg-calm px-4 py-2 text-sm font-semibold text-primary">
              <Sparkles aria-hidden="true" size={17} /> Design system preview
            </div>
          </div>
        </header>

        <Section eyebrow="01 · Color" title="A warm, semantic palette">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map(([name, hex, color]) => (
              <div className="surface-base overflow-hidden" key={name}>
                <div
                  aria-label={`${name} ${hex}`}
                  className="h-20 border-b border-border"
                  style={{ backgroundColor: color }}
                />
                <div className="p-3">
                  <p className="font-semibold">{name}</p>
                  <code className="text-sm text-muted">{hex}</code>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Memory", "var(--color-chart-memory)"],
              ["Attention", "var(--color-chart-attention)"],
              ["Recall", "var(--color-chart-recall)"],
              ["Pattern", "var(--color-chart-pattern)"],
            ].map(([label, color]) => (
              <div
                className="flex items-center gap-3 rounded-control border border-border bg-surface px-4 py-3"
                key={label}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="font-semibold">{label}</span>
              </div>
            ))}
          </div>
          <div
            className="surface-soft grid gap-3 p-4 sm:grid-cols-5 sm:items-end"
            aria-label="Spacing scale"
            role="group"
          >
            {[1, 2, 3, 4, 6].map((step) => (
              <div className="grid gap-2" key={step}>
                <span className="text-sm font-semibold text-muted">
                  {step * 4}px
                </span>
                <span
                  aria-hidden="true"
                  className="block h-3 rounded-pill bg-primary"
                  style={{ width: `${step * 4}px` }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="02 · Type" title="Clear at every size">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card className="grid gap-4">
              <p className="font-display text-4xl leading-tight">
                Small steps make a big difference.
              </p>
              <h3 className="text-2xl font-bold">A reassuring section title</h3>
              <p className="text-lg leading-relaxed">
                Body large keeps important guidance comfortable to read for
                patients and families.
              </p>
              <p className="text-muted">
                Supporting text provides context without competing with the
                action.
              </p>
              <p className="text-sm font-bold">FORM LABEL / BUTTON TEXT</p>
            </Card>
            <div className="surface-soft grid content-center gap-3 p-5">
              <p className="text-sm font-semibold text-muted">
                PATIENT TEXT SCALE
              </p>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Text size examples"
              >
                {["Normal", "Large", "Extra large"].map((label, index) => (
                  <span
                    className="rounded-pill border border-border bg-surface px-3 py-2"
                    key={label}
                    style={{ fontSize: `${1 + index * 0.2}rem` }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted">
                Patient screens start at a comfortable 20px body size.
              </p>
            </div>
          </div>
        </Section>

        <Section eyebrow="03 · Actions" title="Tactile, steady buttons">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BigButton className="text-center" onClick={() => setNotice(true)}>
              Primary action{" "}
              <ArrowRight
                aria-hidden="true"
                className="ml-2 inline"
                size={18}
              />
            </BigButton>
            <BigButton className="text-center" variant="secondary">
              Secondary
            </BigButton>
            <BigButton className="text-center" variant="soft">
              Soft action
            </BigButton>
            <BigButton className="text-center" variant="accent">
              Warm accent
            </BigButton>
            <BigButton className="text-center" variant="quiet">
              Quiet action
            </BigButton>
            <BigButton className="text-center" variant="danger">
              Danger action
            </BigButton>
            <BigButton className="text-center" disabled>
              Unavailable
            </BigButton>
            <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-4">
              <IconButton label="Notifications">
                <Bell aria-hidden="true" size={20} />
              </IconButton>
              <span className="text-sm text-muted">Icon button · labelled</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="min-h-[44px] rounded-control border border-border bg-surface px-4 font-semibold hover:bg-calm"
              onClick={() => setNotice(true)}
            >
              Professional action
            </button>
            <button
              aria-pressed={enabled}
              className={`inline-flex min-h-[44px] items-center gap-3 rounded-control border px-3 font-semibold ${enabled ? "border-primary/30 bg-calm text-primary" : "border-border bg-surface text-muted"}`}
              onClick={() => setEnabled(!enabled)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 rounded-pill transition-colors ${enabled ? "bg-primary" : "bg-border"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </span>
              Reminders {enabled ? "on" : "off"}
            </button>
            <button
              className="min-h-[44px] rounded-control border border-border bg-surface px-4 font-semibold hover:bg-calm"
              onClick={() => setShowDialog(true)}
              type="button"
            >
              Open accessible dialog
            </button>
          </div>
          {notice && (
            <div
              className="flex items-center justify-between gap-4 rounded-control border border-success/20 bg-calm px-4 py-3 text-success"
              role="status"
            >
              <span className="flex items-center gap-2">
                <Check aria-hidden="true" size={18} /> Action completed gently.
              </span>
              <button
                aria-label="Dismiss message"
                className="rounded px-2 py-1 font-bold"
                onClick={() => setNotice(false)}
              >
                Dismiss
              </button>
            </div>
          )}
        </Section>

        <Section eyebrow="04 · Surfaces" title="Quiet depth, used with care">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-base p-5">
              <p className="font-bold">Base surface</p>
              <p className="mt-2 text-sm text-muted">
                Opaque, clear, and dependable for everyday content.
              </p>
            </div>
            <div className="surface-soft p-5">
              <p className="font-bold">Soft surface</p>
              <p className="mt-2 text-sm text-muted">
                A calm grouping surface without extra elevation.
              </p>
            </div>
            <div className="surface-elevated surface-interactive p-5">
              <p className="font-bold">Elevated interactive</p>
              <p className="mt-2 text-sm text-muted">
                A restrained lift on pointer hover.
              </p>
            </div>
          </div>
          <div className="glass-surface rounded-card p-5">
            <p className="font-bold">Glass, reserved for orientation</p>
            <p className="mt-1 text-sm text-muted">
              Use for non-critical navigation and overlays. Essential content
              stays opaque.
            </p>
          </div>
        </Section>

        <Section eyebrow="05 · Forms & status" title="Accessible by default">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface-base grid gap-4 p-5">
              <TextField
                label="Email address"
                type="email"
                placeholder="you@example.com"
                hint="We’ll use this to send account updates."
              />
              <TextField
                label="Password"
                type="password"
                placeholder="Enter a password"
                autoComplete="new-password"
              />
              <TextField
                label="Example with error"
                defaultValue="not-an-email"
                error="Enter an email address in the usual format."
              />
              <label className="grid gap-2 text-sm font-bold">
                Preferred language
                <select className="min-h-[52px] rounded-control border border-border bg-surface px-4 font-normal text-text">
                  <option>English</option>
                  <option>অসমীয়া</option>
                  <option>বাংলা</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Care note
                <textarea
                  className="min-h-24 rounded-control border border-border bg-surface p-4 font-normal text-text"
                  placeholder="Add a short note"
                />
              </label>
              <TextField
                label="Unavailable field"
                disabled
                value="Managed by your care team"
              />
              <label className="flex min-h-[48px] items-center gap-3 font-semibold">
                <input
                  className="h-5 w-5 accent-[var(--primary)]"
                  type="checkbox"
                />{" "}
                I agree to receive care reminders
              </label>
            </div>
            <div className="grid content-start gap-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge>Upcoming</StatusBadge>
                <StatusBadge tone="success">Taken</StatusBadge>
                <StatusBadge tone="warning">Needs attention</StatusBadge>
                <StatusBadge tone="danger">Missed</StatusBadge>
                <StatusBadge tone="info">In progress</StatusBadge>
              </div>
              <div
                className="rounded-control border border-warn/25 bg-accent-light p-4 text-text"
                role="alert"
              >
                <p className="flex items-center gap-2 font-bold">
                  <Bell aria-hidden="true" size={18} /> Reminder needs attention
                </p>
                <p className="mt-1 text-sm">
                  Keep urgent information on a solid, high-contrast surface.
                </p>
              </div>
              <div className="surface-base p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">Weekly progress</span>
                  <span className="text-sm text-muted">3 of 5 days</span>
                </div>
                <div
                  aria-label="Weekly progress: 60 percent"
                  className="mt-3 h-3 overflow-hidden rounded-pill bg-surface-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={60}
                >
                  <div className="h-full w-3/5 rounded-pill bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="06 · Navigation & feedback"
          title="Small patterns, shared everywhere"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface-base p-4">
              <div
                aria-label="Example tabs"
                className="flex flex-wrap gap-2 border-b border-border pb-3"
                onKeyDown={handleTabKeyDown}
                role="tablist"
              >
                {tabs.map((tab) => {
                  const id = `ds-tab-${tab.toLowerCase().replaceAll(" ", "-")}`;
                  return (
                    <button
                      aria-controls="ds-tab-panel"
                      aria-selected={selectedTab === tab}
                      className={`min-h-[44px] rounded-control px-4 font-semibold ${selectedTab === tab ? "bg-calm text-primary" : "text-muted hover:bg-surface-muted"}`}
                      id={id}
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      role="tab"
                      tabIndex={selectedTab === tab ? 0 : -1}
                      type="button"
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
              <p
                aria-labelledby={`ds-tab-${selectedTab.toLowerCase().replaceAll(" ", "-")}`}
                className="pt-4"
                id="ds-tab-panel"
                role="tabpanel"
                tabIndex={0}
              >
                Showing <strong>{selectedTab.toLowerCase()}</strong>{" "}
                information.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div
                  aria-label="Patient avatar"
                  className="grid h-12 w-12 place-items-center rounded-full bg-calm font-bold text-primary"
                >
                  <UserRound aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold">Sushila Devi</p>
                  <p className="text-sm text-muted">Patient · Assam</p>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto text-muted"
                />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="surface-soft flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-control bg-surface text-primary">
                  <Search aria-hidden="true" size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-2/5 animate-pulse rounded bg-border" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-border/70" />
                </div>
                <span className="text-sm text-muted">Loading</span>
              </div>
              <div className="surface-base flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-control bg-calm text-primary">
                  <ShieldCheck aria-hidden="true" size={20} />
                </div>
                <div>
                  <p className="font-bold">Secure and private</p>
                  <p className="text-sm text-muted">
                    Your care information is protected.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-pill bg-[var(--color-chart-memory)]/10 px-3 py-2 text-sm font-bold text-primary">
                  Memory
                </span>
                <span className="rounded-pill bg-accent-light px-3 py-2 text-sm font-bold text-warn">
                  Attention
                </span>
                <span className="rounded-pill bg-lavender px-3 py-2 text-sm font-bold text-info">
                  Recall
                </span>
              </div>
              <div className="surface-base p-4">
                <p className="font-bold">Cognitive chart language</p>
                <svg
                  aria-label="Memory, attention and recall increase across four sessions"
                  className="mt-3 h-36 w-full"
                  role="img"
                  viewBox="0 0 400 145"
                >
                  {[30, 65, 100, 135].map((y) => (
                    <line
                      key={y}
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      x1="32"
                      x2="390"
                      y1={y}
                      y2={y}
                    />
                  ))}
                  <polyline
                    fill="none"
                    points="32,112 145,88 267,75 390,42"
                    stroke="var(--color-chart-memory)"
                    strokeWidth="2.5"
                  />
                  <polyline
                    fill="none"
                    points="32,126 145,109 267,92 390,77"
                    stroke="var(--color-chart-attention)"
                    strokeWidth="2.5"
                  />
                  <polyline
                    fill="none"
                    points="32,137 145,121 267,112 390,99"
                    stroke="var(--color-chart-recall)"
                    strokeWidth="2.5"
                  />
                  <polyline
                    fill="none"
                    points="32,130 145,116 267,88 390,61"
                    stroke="var(--color-chart-pattern)"
                    strokeWidth="2.5"
                  />
                  {["32,112", "145,88", "267,75", "390,42"].map((point) => {
                    const [cx, cy] = point.split(",");
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        fill="var(--surface)"
                        key={point}
                        r="4"
                        stroke="var(--color-chart-memory)"
                        strokeWidth="2.5"
                      />
                    );
                  })}
                </svg>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-chart-memory">● Memory</span>
                  <span className="text-chart-attention">● Attention</span>
                  <span className="text-chart-recall">● Recall</span>
                  <span className="text-chart-pattern">● Pattern</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                  <span
                    className="rounded-md border border-border bg-surface px-3 py-2 shadow-soft"
                    title="Session 4 · Memory score 82"
                  >
                    Session 4: <strong className="text-text">82</strong>
                  </span>
                  <span>
                    Keyboard focus and hover retain a visible outline.
                  </span>
                </div>
              </div>
              <div className="surface-soft flex flex-wrap items-center gap-4 p-4">
                <span className="text-sm font-semibold">Icon sizes</span>
                {[16, 20, 24, 32].map((size) => (
                  <span
                    className="inline-flex items-center gap-1 text-muted"
                    key={size}
                  >
                    <Sparkles aria-hidden="true" size={size} />
                    <span className="text-xs">{size}</span>
                  </span>
                ))}
                <button
                  className="rounded-control border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-calm focus-visible:outline"
                  title="A short helpful hint"
                >
                  Tooltip example
                </button>
              </div>
              <p className="rounded-control bg-surface-muted p-3 text-sm text-muted">
                Reduced motion: decorative movement follows the system
                preference and stops when reduced motion is enabled.
              </p>
            </div>
          </div>
        </Section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted">
          <p>SMĀRANA · Cognitive Care for Brighter Days</p>
          <p className="flex items-center gap-2">
            <Sun aria-hidden="true" size={16} /> Calm by default{" "}
            <Moon aria-hidden="true" className="ml-2" size={16} /> Theme tokens
            ready
          </p>
        </footer>
      </div>

      <dialog
        aria-labelledby="sample-dialog-title"
        className="m-auto w-[min(92vw,32rem)] rounded-card border border-border bg-surface p-0 text-text shadow-lift backdrop:bg-text/30"
        onClose={() => setShowDialog(false)}
        ref={dialogRef}
      >
        <div className="p-6 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-control bg-calm text-primary">
            <Heart aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-2xl font-bold" id="sample-dialog-title">
            A gentle confirmation
          </h2>
          <p className="mt-2 text-muted">
            Native dialog behavior keeps this example keyboard and screen-reader
            friendly.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="min-h-[44px] rounded-control px-4 font-semibold hover:bg-surface-muted"
              onClick={() => setShowDialog(false)}
              type="button"
            >
              Close
            </button>
            <button
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-primary px-4 font-bold text-primary-text"
              onClick={() => setShowDialog(false)}
              type="button"
            >
              <Mail aria-hidden="true" size={17} /> Continue
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
