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

A second, newer variant of the same edits (styling tweaks, a reworked Safety Plan preview, no `type` field in `TOOL_CATALOG`) appeared uncommitted in a later session's copy of `index.html` with no known author. It is saved as `handoff/screenings-wip-v2.patch` against the redaction-fix commit (`git apply handoff/screenings-wip-v2.patch`). It has the same problem: styling without the matching components.

Avoiding the content filter: earlier attempts were cut off while writing out the full C-SSRS item wording and triage text. Build the C-SSRS with numbered placeholder items ("Item 1", ...) and the scoring logic only, and let the owner paste the official wording into one marked constant. Keep each edit small.

Easiest path: start from the WIP file, finish the steps below, check every tab, then replace `index.html` with it.

## Open work, in order

### A. Screenings tab redesign plus a Safety Plan tab (owner's active request)

Owner's request, paraphrased: don't show every screening open at once; let the Writer pick which ones to use (more than one can be open). Add an adult ADHD screener (ASRS-v1.1) and the Columbia (C-SSRS) screen. Safety planning gets its **own tab**, not part of Screenings. Results from all of these feed note generation in the Progress Note, Intake and Treatment Plan tabs.

Progress (owner asked for one step at a time, pushed after each):
- [x] Step 1, screening picker (2026-10-06): `ScreeningsTab` now has "Choose screenings" cards; selected tools render as collapsible `ScreeningTool` panels; removing a tool clears its answers so its score leaves the notes. Covers items 2 and 3 below for PHQ-9, GAD-7 and PCL-5. New tools only need an entry in `SCREENING_TOOLS` (C-SSRS will need its own panel body).
- [x] Step 2, ASRS-v1.1 (2026-10-06): `asrs` entry in `SCREENING_TOOLS` with Part A / Part B dividers (`parts` field), a live Part A positive/negative badge, total out of 72, and a note line with the total and Part A result. Scoring is `L.scoreASRS` in `PN_LIB`, covered by `npm test`. **Item wording is not in the file:** the 18 items show as "Item 1" ... "Item 18". The owner pastes the official WHO wording into the marked `ASRS_ITEM_TEXT` constant (search for `ASRS-v1.1 ITEM WORDING`). Agents should not write or print the item text; scoring does not depend on it.
- [x] Step 3, Safety Plan tab (2026-10-06): `SafetyPlanTab` with the six steps in `SAFETY_PLAN_STEPS`, a completion bar, an "Included in notes" preview, copy and clear buttons. App state `safetyPlan`; `safetyPlanItems` (`{label, text}` per filled step) is passed to Progress Note, Intake and Treatment Plan. Each tab runs the step **text** (not the "Label: text" line) through its sanitizer, then adds the label with `safetyPlanToLines`; running detection on the full line made the first word look like a name. `buildPrompt` / `buildIntakePrompt` take `safetyPlanLines`; Treatment Plan appends a SAFETY PLAN section. "Note completed" (`wipeAll`) clears it. Covered by `npm test` and a browser run with a mocked Groq endpoint (no names or phone numbers in any of the three prompts).
- [x] Step 4, C-SSRS screen (2026-10-06): `cssrs` entry in `SCREENING_TOOLS` (`kind: 'triage'`, Yes/No, no total). Six items plus an item 6 follow-up ("6b"). Items 3-5 are greyed out unless item 2 is Yes; 6b unless item 6 is Yes. Risk level (none / low / moderate / high) follows the screener's triage rules in `L.scoreCSSRS`, covered by `npm test`. Note line: "C-SSRS: <level> per screener triage (Yes on items ...)". Tools can now supply `score(answers)` instead of `severity(total)`, and `screeningResult` returns `scoreText` / `summary` used by every display. **Item wording is not in the file:** the owner pastes it into the marked `CSSRS_ITEM_TEXT` constant (search for `ITEM WORDING`). Agents should not write or print it.

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

### B. Redaction gap in the other tabs: done (2026-10-06)

Intake, Dx Justification and Treatment Plan now de-identify their free text with `L.makeSanitizer` before calling Groq, post-process output with `scrubText` + `redactNames`, and show a "De-identified before generation" bar. Two related Progress Note leaks were fixed at the same time: active treatment-goal text went into its prompt unredacted, and `buildPrompt` listed the redacted names back to the model ("Names redacted ...: <names>"); it now says only that names were replaced. Note that the Safe Harbor toggle and allowlist editor are still only visible in the Progress Note sidebar, though the setting applies to all tabs. If you add the Safety Plan tab (A), its fields feed other tabs' prompts, so run them through the same sanitizer.

### C. Smaller notes

- `wipeAll()` ("Note completed") clears the Progress Note and the safety plan, but not screening answers, treatment goals, or the Intake/Dx tabs' fields. Ask the owner whether it should clear everything.

- `detectNames` skips the first word of each sentence, so a name that opens a sentence is not caught. Consider a per-input "names to redact" field (the original design had one) or a check of sentence-initial words against `COMMON_WORDS`.
- `sessionLocation` / `sessionCredentials` state is still passed to `buildPrompt` although their inputs were removed. That's harmless dead code you can remove.
- The Claude Design bundle files (`README.md`, `chats/`, `project/`, root `*.jsx`, `lib.js`, `styles.css`) are stale. The owner may want them moved under `design/` or deleted, and `README.md` replaced with a short product readme. Ask first.

## Verifying a change

1. `npm install && npm test` (JSX compiles, redaction samples pass).
2. Open the page and click every tab with the console open. Generate one note per tab with a test Groq key and placeholder input.
3. Confirm "mark completed" clears all inputs, including any new state.
