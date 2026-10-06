# Handoff: current state and next steps

Last updated 2026-10-06. Read `CLAUDE.md` first for architecture and ground rules.

## Where things stand

- `index.html` on `main` is the live app (3,541 lines). It matches the last file the previous Claude session delivered (2026-10-06 16:38 UTC), which the owner uploaded as commit `3b1d00e` ("Enhance screenings tab styles and update score handling").
- Tabs that work today: Progress Note, Intake Assessment, Dx Justification, Treatment Plan, Screenings (PHQ-9, GAD-7, PCL-5, all shown open at once). Screening scores and active treatment goals already flow into the note prompts.
- After that upload, the previous session started a Screenings redesign and a Safety Plan tab, but kept getting cut off mid-edit and never delivered the file. That in-progress file has been recovered into `handoff/index.wip-screenings.html` (3,616 lines).

### How complete the recovery is

The WIP file was rebuilt by replaying the previous session's ten recorded edits onto `main`'s `index.html`. Every edit applied cleanly, and all 1,160 file lines that the old session read back after its last edit match the rebuilt file exactly, so this is the file as it existed when that session stopped. It compiles and loads without console errors, and redaction output is unchanged.

It is **not** shippable as-is. Its new Screenings CSS was written for a selector layout whose components were never written, so the existing Screenings tab renders without its card styling. That's why `index.html` was left unchanged and the WIP is kept as a reference.

What the WIP file contains, relative to `main`:
1. New Screenings CSS (selector cards, collapsible panels, summary bar) plus Safety Plan CSS.
2. `TOOL_CATALOG` constant listing PHQ-9, GAD-7, PCL-5, ASRS-v1.1, C-SSRS (currently unused).
3. `buildPrompt` and `buildIntakePrompt` accept `safetyPlanLines` and add a short "Safety plan completed this session" section to the prompt.
4. A one-word copy change in the PHQ-9 `meta` line of `SCREENING_TOOLS`.

Easiest path: start from the WIP file, finish the steps below, check every tab, then replace `index.html` with it.

## Open work, in order

### A. Screenings tab redesign plus a Safety Plan tab (owner's active request)

Owner's request, paraphrased: don't show every screening open at once; let the Writer pick which ones to use (more than one can be open). Add an adult ADHD screener (ASRS-v1.1) and the Columbia (C-SSRS) screen. Safety planning gets its **own tab**, not part of Screenings. Results from all of these feed note generation in the Progress Note, Intake and Treatment Plan tabs.

Remaining steps (line numbers refer to the WIP file and are approximate):
1. `SCREENING_TOOLS` (~2089, right after `TOOL_CATALOG`): add `asrs` and `cssrs` entries.
   - ASRS-v1.1: 18 self-report items, 0-4 scale (Never / Rarely / Sometimes / Often / Very often), max 72. Part A = items 1-6; items 1-3 count as positive at >= 2 ("Sometimes"), items 4-6 at >= 3 ("Often"); 4 or more positive Part A items = positive screen. Show Part A / Part B dividers. Use the published item wording from the WHO ASRS-v1.1 form.
   - C-SSRS (screen version): clinician-rated, not a Likert scale. One "highest level" selection across the screen's ideation levels plus yes/no behavior items, mapped to a low / moderate / high risk summary per the published screen. Use the official C-SSRS screener wording and triage guidance rather than paraphrasing. Suggested state shape: `screeningAnswers.cssrs = { ideationLevel: n, <behaviorKey>: bool, ... }`.
2. `ScreeningTool` (~2196): replace with a collapsible panel (props `toolKey, answers, onChange, onClear, collapsed, onToggleCollapse`) that renders scale tools (with ASRS part dividers) and the C-SSRS layout.
3. `ScreeningsTab` (~2247): selector cards from `TOOL_CATALOG` at the top; clicking toggles a tool in `activeKeys`; active tools render below as collapsible panels; keep the existing summary and copy button.
4. New `SafetyPlanTab` after `ScreeningsTab`: Stanley-Brown six steps as six textareas (`warningSigns, copingStrategies, socialSupports, professionalContacts, safeEnvironment, reasonsForLiving`), a completion indicator, and no generate button of its own.
5. `App`: add `safetyPlan` state (six empty strings) and a `safetyPlanLines` `useMemo` (one "Label: text" line per filled field).
6. `App.screeningLines`: add ASRS (total and Part A result) and C-SSRS (risk summary) lines alongside the existing total/severity lines.
7. `App.generate()`: pass `safetyPlanLines` to `buildPrompt`.
8. `App` top bar: add a "Safety Plan" tab button (`appMode === 'safety'`) and render `<SafetyPlanTab>`.
9. `IntakeTab` and `TreatmentPlanTab`: accept a `safetyPlanLines` prop; Intake passes it to `buildIntakePrompt`, Treatment Plan appends a "SAFETY PLAN:" section to its prompt. Pass the prop from `App`.
10. Include `safetyPlan` in `wipeAll()` so "mark completed" clears it, since notes must not persist.

Practical tip: these items are long. Write them in small edits (one tool or component per edit) and keep the item text in code, not in chat messages.

### B. Redaction gap in the other tabs (privacy, high priority)

Only the Progress Note tab redacts before calling Groq. Intake (`IntakeTab.generate`), Dx Justification (`DxTab.generate`, the `observations` text) and Treatment Plan (`TreatmentPlanTab.generate`, goal text) send their free text as typed. Fix: run each free-text field through the same `detectNames` + `redactNames` + `redactPHI` path (honoring the allowlist and Safe Harbor toggle), and post-process output with `redactNames` like the Progress Note tab does. Ideally lift `sanitize` into a shared helper. Add cases to `scripts/check.mjs`.

### C. Smaller notes

- `detectNames` skips the first word of each sentence, so a name that opens a sentence is not caught. Consider a per-input "names to redact" field (the original design had one) or a check of sentence-initial words against `COMMON_WORDS`.
- `sessionLocation` / `sessionCredentials` state is still passed to `buildPrompt` although their inputs were removed. That's harmless dead code you can remove.
- The Claude Design bundle files (`README.md`, `chats/`, `project/`, root `*.jsx`, `lib.js`, `styles.css`) are stale. The owner may want them moved under `design/` or deleted, and `README.md` replaced with a short product readme. Ask first.

## Verifying a change

1. `npm install && npm test` (JSX compiles, redaction samples pass).
2. Open the page and click every tab with the console open. Generate one note per tab with a test Groq key and placeholder input.
3. Confirm "mark completed" clears all inputs, including any new state.
