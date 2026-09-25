# SMĀRANA interface system

SMĀRANA’s interface is built around one product rule: premium enough to inspire confidence, simple enough to support an older adult without training, reassuring to families, and clinically useful to professionals.

## Direction

- **70% calm healthcare:** warm ivory canvas, deep navy text, botanical green identity, large patient controls, direct hierarchy.
- **20% restrained glass:** reserved for sticky navigation and transient shells. Medication, alerts, errors, and primary actions remain opaque.
- **10% personality:** warm orange highlights, lavender memory surfaces, soft botanical geometry, and a consistent Lucide icon language.

## Role density

- **Patient:** large, guided, emotional, minimal. Home answers “what should I do now?” with voice, the next activity, then exploration.
- **Caregiver:** practical and actionable. Today’s state, adherence, sync status, and alerts lead.
- **Doctor:** analytical and structured. Patient → trend → session → intervention remains the navigation model.
- **Admin:** conventional and operational. Django Admin remains the authoritative boundary.

## Accessibility contract

- Patient controls use a 64px minimum target; professional controls use 44px.
- Visible 3px focus rings use the warm accent color.
- Body copy starts at 20px before the user’s text scaling preference is applied.
- Every motion treatment supports `prefers-reduced-motion`; transforms are removed and fades are shortened.
- Primary green, navy, ivory, and muted text combinations target WCAG AA contrast.
- Routes, auth behavior, private media, offline repositories, voice actions, and game/DDA behavior are presentation-independent and must not be altered by styling work.

## Motion

Motion is limited to state, attention, and spatial continuity. It uses shared durations and springs from `src/shared/motion/tokens.ts`. UI transitions animate transform and opacity only. Listening uses one gentle breathing signal; active task screens remove decorative movement.

## Foundation audit

- **Keep:** React + Tailwind, CSS custom properties, Lucide icons, current role layouts, light/dark theme provider, patient font scaling, and the 64px patient control target.
- **Improve:** consolidate palette, spacing, radius, elevation, type, and chart semantics in shared tokens; extend existing button/card/status primitives; use labelled input and icon-button primitives for new work.
- **Replace gradually:** repeated one-off color and interaction values as each screen is touched. Existing business logic and route behavior stay outside this M1 presentation pass.
- **Deprecate:** new raw palette values, unlabelled icon-only controls, per-component shadow invention, and ad-hoc durations. Existing occurrences should be migrated incrementally, not through a risky page rewrite.

## Tokens and chart rules

`src/shared/theme/tokens.css` is the runtime source of truth; `design-tokens.json` is its portable reference. Tailwind exposes semantic aliases alongside existing class names. The spacing rhythm is 4/8/12/16/20/24/32/40/48px. Elevation is reserved for selected surfaces and interactive hover states.

Chart series use Memory `--color-chart-memory`, Attention `--color-chart-attention`, Recall `--color-chart-recall`, and Pattern `--color-chart-pattern`. Use 2px primary series, 1px secondary and grid rules, muted navy axis labels, low-contrast gridlines, 4–6px outlined points, and an opaque tooltip with a visible series label. Do not communicate status by color alone.

Responsive breakpoints are 480 / 768 / 1024 / 1280 / 1536px. At larger text scales, preserve labels and allow content to wrap before reducing information. Patient interactions target 64px; professional controls target 44px.

An internal `/design-system` showcase is available only in Vite development mode. It exercises color, type, surfaces, buttons, form labels/errors, status, progress, tabs, dialog behavior, avatars, loading, and feedback patterns.

## Component rules

- Extend `BigButton`, `Card`, `IconTile`, `PageState`, and `StatusBadge` before adding parallel primitives.
- Avoid cards inside cards. Use borders, dividers, and surface tone to group related content.
- Keep medication, emergency, and error content on opaque surfaces.
- Use one labelled Lucide icon system; important patient actions never rely on icons alone.
