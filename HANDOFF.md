# Handoff: current state and next steps

Last updated 2026-10-06. Read `CLAUDE.md` first for architecture and ground rules.

## Where things stand

- `index.html` on `main` is the live app. Work happens on a branch and reaches `main` through a PR that the owner merges. Merge `origin/main` into your branch before starting: `main` holds the owner's screening item wording.
- **Do not print the ASRS-v1.1 / C-SSRS item wording**, or the existing PHQ-9 / GAD-7 / PCL-5 items (see the CLAUDE.md ground rules). `npm test` checks the wording areas have the right item counts with one item per line. An upload with wrapped items once blanked the live site.

### Tabs and features

- **Progress Note:**
  - SOAP / DAP / BIRP / GIRP / PIRP / EMR / narrative formats, tone and length controls, interventions, MSE, risk.
  - Per-section Edit / Regenerate / Copy, a "Revise whole note" bar (Shorter, More detailed, More clinical, Plainer wording, custom), and Undo.
  - "Copy" and "Copy plain text" (no headings).
- **Intake Assessment:** CPT 90791 narrative, "Copy plain text".
- **Dx Justification:** DSM criteria picker, justification statement.
- **Treatment Plan:** goals (App state; active goals also feed the Progress Note), narrative.
- **Screenings:**
  - Picker cards and collapsible panels for PHQ-9, GAD-7, PCL-5, ASRS-v1.1 (Part A result, total /72) and the C-SSRS screen.
  - The C-SSRS uses yes/no items with skip logic and a triage risk level.
  - Completed results become `screeningLines` in the prompts.
- **Safety Plan:**
  - Six Stanley-Brown steps. Filled steps feed the Progress Note, Intake and Treatment Plan prompts, de-identified first.
  - "Print / Save as PDF" makes a one-page client copy (not de-identified, never sent anywhere).
- **Privacy:**
  - A shared privacy card (Safe Harbor toggle, allowlist, "Names to always redact") on every tab that sends text.
  - Sentence-start name detection (see CLAUDE.md).
- **Dictation:** the mic on the Progress Note, and a floating Dictate button on Intake, Dx, Treatment Plan and Safety Plan that types into the last-clicked box.
- **"Note completed" (`wipeAll()`):**
  - Clears all client data: the note and inputs, screening answers, goals, safety plan, names-to-redact, and the Intake, Dx, Treatment Plan and Screenings drafts (remounted through `resetKey`).
  - Settings, allowlist and the Groq key are kept.
  - Any new App-level client state must be added to it.
- **Drafts survive tab switches.** Intake, Dx, Treatment Plan and Screenings stay mounted and are hidden, so browser tests should target `:visible` elements.
- **Header:**
  - One line with a merged "De-identified · nothing saved" pill.
  - Short tab labels below 1400px.
  - Dots on tabs that hold content (`useReportContent`).
  - A scrollable tab row on phones.
  - A per-tab "Jump to" button on phones.

### Things to know

- **Loading.**
  - React loads as production builds.
  - The two JSX blocks use `data-presets="react"`, which skips Babel's env transform (load about 2.1 s -> 0.9 s locally).
  - Without env, `const`/`let` keep their temporal dead zone: using a `const` before its declaration during render throws. Declare things before use.
- **Name detection trade-off.** A sentence-opening name followed only by "was/is/has" ("Morgan was late.") is not caught on its own, because ordinary nouns open sentences the same way. It is caught if the name appears mid-sentence anywhere, or is in "Names to always redact". `scripts/check.mjs` has the cases.
- **The Progress Note prompt includes session details only when the Writer enters a date or times.** The old hidden "In-Office (POS 11)" location default was removed on 2026-10-06.

## Open work

- The Claude Design prototype files (`README.md`, `chats/`, `project/`, root `app.jsx`, `lib.js`, `styles.css`, `tweaks-panel.jsx`) are stale. The owner may want them deleted or moved under `design/`, and `README.md` replaced with a short product readme. Ask first.
- Ideas not yet requested:
  - a location/modality field for the Progress Note (the old hidden default was removed),
  - showing a live "names detected" preview while typing on tabs other than the Progress Note.

## Verifying a change

1. `npm install && npm test`: JSX compiles, the redaction, scoring and note-helper samples pass, and the item wording areas are well formed.
2. Load the page in a browser (Playwright can serve the libraries from `node_modules`; see CLAUDE.md) and click every tab with the console open. Generate one note per tab against a test Groq key or a mocked endpoint, using placeholder input.
3. Check that no names or identifiers appear in the captured prompts.
4. Confirm "Note completed" clears all inputs, including any new state.
