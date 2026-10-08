# Handoff: current state and next steps

Last updated 2026-10-08. Read `CLAUDE.md` first for architecture and ground rules.

## Where things stand

- `index.html` on `main` is the live app. Work happens on a branch and reaches `main` through a PR that the owner merges. Merge `origin/main` into your branch before starting: `main` holds the owner's screening item wording.
- **Do not print the ASRS-v1.1 / C-SSRS item wording**, or the existing PHQ-9 / GAD-7 / PCL-5 items (see the CLAUDE.md ground rules). `npm test` checks the wording areas have the right item counts with one item per line. An upload with wrapped items once blanked the live site.

### Tabs and features

- **Progress Note:**
  - Note types: session note, cancellation / no-show (written on-device, no model call), collateral contact, discharge summary. Late entry flag.
  - SOAP / DAP / BIRP / GIRP / PIRP / EMR / narrative formats, tone and length controls, interventions, MSE (with Perception, Cognition, a "Within normal limits" fill and mood in the client's words), risk.
  - Session info: service type (individual, family with/without client, group, crisis), modality (in person / video / phone) with telehealth consent, location verified, client at home and state, interactive complexity. A suggested CPT code (with -95/-93 and POS 10/02) shows in the sidebar and in an on-device header above the note.
  - Risk card: "All denied", SI details (passive, plan, intent, means, prior attempt), access to lethal means, protective factors, overall risk level. If risk is blank, Generate asks first: mark all denied, or generate with "risk not assessed".
  - Diagnosis (shared with Intake) and per-goal "progress this session" feed a medical-necessity instruction.
  - Signature line (`pn.signature`) added under copied notes.
  - Per-section Edit / Regenerate / Copy, a "Revise whole note" bar (Shorter, More detailed, More clinical, Plainer wording, custom), and Undo.
  - "Copy" and "Copy plain text" (no headings).
- **Intake Assessment:** CPT 90791 narrative with psychosocial history, trauma summary, legal history, strengths, consent reviewed, collateral sources, lethal means, risk level, level-of-care rationale, modality and telehealth. "Copy plain text".
- **Dx Justification:** DSM criteria picker, justification statement.
- **Treatment Plan:** goals with problem, objectives and interventions (App state; active goals also feed the Progress Note), plan frequency, review date, client participation, diagnosis; narrative via `buildPlanPrompt`.
- **Screenings:**
  - Optional previous total per tool; the change since last time goes into the notes.
  - Picker cards and collapsible panels for PHQ-9, GAD-7, PCL-5, ASRS-v1.1 (Part A result, total /72) and the C-SSRS screen.
  - The C-SSRS uses yes/no items with skip logic and a triage risk level.
  - Completed results go automatically into the Progress Note, Intake, Dx Justification and Treatment Plan prompts. The Dx prompt is told to cite relevant scores as supporting evidence only.
  - A "Screenings in this note" strip under each tab's Generate button shows them, each with a checkbox to leave it out of that tab's note (`excludedScreenings`, cleared by "Note completed"). Partly answered screenings are listed as "n/m answered · not included" and link to the Screenings tab.
- **Safety Plan:**
  - Six Stanley-Brown steps. Filled steps feed the Progress Note, Intake and Treatment Plan prompts, de-identified first.
  - "Print / Save as PDF" makes a one-page client copy (not de-identified, never sent anywhere).
- **Privacy:**
  - No dates reach the model (see CLAUDE.md, Privacy data flow).
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

- The original Claude Design prototype files were deleted on 2026-10-06 at the owner's request (still in Git history before commit "Remove the Claude Design prototype files").
- 2026-10-08: the owner asked for every item in the LCSW review (`/mnt/project-files/reviews/lcsw-first-look.md` in the project), which added the modality field the owner had earlier declined. Only the state is captured, and it stays in the on-device header.
- Ideas not yet requested:
  - showing a live "names detected" preview while typing on tabs other than the Progress Note.

## Verifying a change

1. `npm install && npm test`: JSX compiles, the redaction, scoring and note-helper samples pass, and the item wording areas are well formed.
2. Load the page in a browser (Playwright can serve the libraries from `node_modules`; see CLAUDE.md) and click every tab with the console open. Generate one note per tab against a test Groq key or a mocked endpoint, using placeholder input.
3. Check that no names or identifiers appear in the captured prompts.
4. Confirm "Note completed" clears all inputs, including any new state.
