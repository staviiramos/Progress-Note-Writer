# Progress Note Writer

A browser tool that helps licensed mental-health clinicians draft de-identified documentation (progress notes, intake assessments, diagnosis justifications, treatment plans) from their own session notes. The clinician is referred to as "Writer"; the person served is "Client" or "Patient" (user's choice).

Live site: GitHub Pages from `main` (`staviiramos.github.io/Progress-Note-Writer/`).

Start every session by reading `HANDOFF.md` for current state and open work.

## Ground rules (from the project owner; do not relax these)

- **One file.** The whole app is `index.html`: React 18 + Babel standalone loaded from unpkg, JSX transformed in the browser, no build step. Keep it a single file unless the owner asks to split it.
- **Privacy first.** Name and PHI redaction (HIPAA Safe Harbor identifiers, plus the user's allowlist) runs on-device *before* anything is sent to the model. Never weaken or bypass it. Never store notes: note content lives in React state only. The only things in `localStorage` are `pn.apikey`, `pn.allowlist` and `pn.signature` (the Writer's own signature line, never sent to the model) (`pn.drafts` and `pn.groqmodel` are legacy keys that the app only removes).
- **Model provider is Groq**, with a key the user pastes into the app. Never hardcode a key, and never put one in the repo, a commit, or a prompt.
- **Neutral wording and placeholder data.** Use clinical, neutral language and obviously fake sample data (no realistic case details) in prompts, tests, fixtures and handoffs. Long handoffs go in a file. A past session lost work because long outputs containing detailed risk-assessment content were stopped by a content filter, so for clinical instruments describe structure and scoring in summary form and keep long item text out of chat output.
- **Never print the screening item wording.** `index.html` contains the official ASRS-v1.1 and C-SSRS item text, pasted by the owner between the `ITEM WORDING: PASTE HERE` / `END ... ITEM WORDING` marker comments (`ASRS_ITEM_TEXT`, `CSSRS_ITEM_TEXT`). Earlier sessions were cut off by a content filter over this kind of text. Do not `cat`, `sed -n`, `Read`, `grep` or diff those line ranges into the conversation, and don't echo existing PHQ-9 / GAD-7 / PCL-5 items either. When you search or view the file, skip or mask those ranges (for example, read around them with line offsets, or pipe output through `sed -E "s/'[^']{30,}'/'<TEXT>'/g"`). Browser tests should report counts and pass/fail, not item text. Don't edit the wording unless the owner asks; if you must touch those lines, do it with a script that never prints them. `npm test` checks the item counts and that each item stays on one line.
- **Test redaction changes** against sample inputs (`npm test`) before calling them done.
- **No AI-style prose in generated notes.** `scrubText` strips em dashes and buzzwords ("delve", "navigate", "tapestry", "underscore", "moreover", ...). Keep that behavior.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | **The app.** Everything that ships. |
| `CLAUDE.md`, `HANDOFF.md` | Agent instructions and current-state handoff. |
| `scripts/check.mjs`, `package.json` | Dev-only offline checks (`npm test`). Not loaded by the app. |
| `README.md` | Short product readme. |

## How `index.html` is organized

Line numbers drift; search for the names below.

1. **`<style>`** (top of file, ~750 lines): design tokens on `:root` (warm paper palette, `--serif` Newsreader, `--sans`), theme/density variants, then per-tab sections (`/* Screenings tab */`, intake, dx, goal cards, ...).
2. **`<script>` with `window.PN_LIB`** (plain JS, marked `═══ lib.js ═══`): pure logic, no React.
   - Config: `FORMATS` (SOAP, DAP, BIRP, GIRP, PIRP, EMR one-paragraph, narrative), `TONES` (conversational / balanced / clinical), `CONCISENESS`, `INTERVENTIONS`, `MSE_FIELDS`, `RISK_ITEMS`.
   - Redaction: `PHI_PATTERNS`, `detectPHI`, `redactPHI` (SSN, phone, email, URL, IP, dates, ZIP, MRN-style IDs, age 90+), `COMMON_WORDS`, `detectNames` (capitalized words minus `COMMON_WORDS` and the allowlist; a sentence-opening word counts only when possessive, followed by another capitalized word, or followed by a person verb in `NAME_FOLLOW_VERBS`, and never when it is in `SENTENCE_START_WORDS`, appears in lowercase elsewhere, or has a non-name suffix), `parseNameList` (the "Names to always redact" field), `redactNames` (replaces with the subject label), `makeSanitizer` (multi-field helper used by the Intake, Dx and Treatment Plan tabs; takes `alwaysRedact`).
   - Output cleanup: `AI_BUZZWORDS`, `BUZZWORD_REPLACE`, `scrubText`.
   - Note types and billing: `NOTE_TYPES` (session, cancellation/no-show, collateral, discharge), `SERVICE_TYPES`, `MODALITIES`, `US_STATES`, `suggestCPT` (CPT from service type + minutes + modality), `buildServiceHeader` (date/time/service/CPT header built on-device), `serviceLines` and `riskLines` (prompt parts), `buildCancellationNote` (no model call), `fillTokens` / `unfillTokens` (date placeholders), `fmtDateUS`.
   - Prompt builders: `buildPrompt` (progress, collateral and discharge notes via `noteType`), `buildIntakePrompt` (+ `INTAKE_HEADINGS`), `buildPlanPrompt`, `buildDxPrompt`; `parseNote` splits model output into format sections, `joinNote` rebuilds it, `plainNote` drops headings, `buildRevisePrompt` asks for a section rewrite or a whole-note revision.
   - `DX_DATABASE`: diagnosis list with criteria groups used by the Dx tab.
3. **`<script type="text/babel">` tweaks panel** (`═══ tweaks-panel.jsx ═══`): floating appearance panel (`useTweaks`, `TweaksPanel`, `TweakRadio`, ...).
4. **`<script type="text/babel">` app** (`═══ app.jsx ═══`):
   - `GROQ_MODEL` / `callGroq`: pinned production chat model (`llama-3.3-70b-versatile`), posts to `https://api.groq.com/openai/v1/chat/completions`, strips `<think>` blocks.
   - Shared UI: `useToast`, tone controls, `ApiKeyModal`, `AllowlistEditor`, `PrivacyControls` + `NamesToRedactField` (privacy card on every tab that sends text), `useSpeechRecognition` (browser dictation), `DictateButton` (floating mic on Intake/Dx/Plan/Safety that types into the last-focused box), `NoteSection` + `REVISE_PRESETS` (Progress Note section edit/regenerate/copy and revise bar), `fmtTime12`.
   - Screenings: `SCREENING_TOOLS` (PHQ-9, GAD-7, PCL-5, ASRS-v1.1, C-SSRS screen; ASRS and C-SSRS item wording is in the marked `ASRS_ITEM_TEXT` / `CSSRS_ITEM_TEXT` constants, filled in by the owner, never print it; scoring is `PN_LIB.scoreASRS` / `scoreCSSRS`), `screeningResult` (shared score summary), `ScreeningTool`, `ScreeningsTab`.
   - Safety plan: `SAFETY_PLAN_STEPS`, `safetyPlanEntries`, `safetyPlanToLines`, `SafetyPlanTab`, `SafetyPlanPrint` + `printSafetyPlan` (client printout via a portal and `body.print-safety` print CSS; deliberately not de-identified, never sent anywhere).
   - Shared clinical cards (module level): `Seg`, `Check`, `ModalityFields`, `MseCard`, `RiskCard` (+ `riskUntouched`), `NoteFrame` + `framedText` (header and signature around a note), `StatusRow`.
   - Tabs: `TreatmentPlanTab` (+ `GoalCard`, which takes `onUpdate(id, patch)`), `IntakeTab`, `DxAutocompleteInput` (controlled by `value`; Progress Note and Intake share App-level `diagnoses`), `DxTab` (+ `SxItem`).
   - `App`: top bar with tab switcher (`appMode`: `progress`, `intake`, `dx`, `plan`, `screenings`, `safety`), Progress Note sidebar and paper-style output, API key handling, app-level state shared across tabs (`screeningAnswers` -> `screeningItems` -> per-tab `linesFor(tab)` minus `excludedScreenings[tab]`, shown by `ScreeningStrip` under each Generate button, `safetyPlan` -> `safetyPlanItems`, `goals`), `generate()` for the progress note, and `wipeAll()` ("Note completed" clears all client data; add any new App-level client state to it). Intake, Dx, Treatment Plan and Screenings stay mounted while hidden so drafts survive tab switches; `wipeAll()` remounts them by bumping `resetKey`.

Conventions worth keeping:
- Define components at module level, not inside other components, so inputs don't remount and lose focus. Use `React.memo`, `useCallback` and refs for stable props (see `GoalCard`, `SxItem`).
- Data flows into prompts as arrays of short lines (`screeningLines`, active goals). New cross-tab data should follow the same pattern: App-level state, a `useMemo` that formats lines, passed as a prop to each tab's generate call.

## Privacy data flow

Dates never go to the model. The session date, times, service, modality, state and CPT go in a header built on-device (`buildServiceHeader`) and shown above the note. Goal target dates and the plan review date go out as `[TARGET-DATE-n]` / `[REVIEW-DATE]` placeholders and are filled in with `fillTokens` after the response; `revise()` turns real dates back into placeholders (`unfillTokens`) before resending a draft. Keep it that way for any new date field.

Progress Note tab: `rawInput` -> `detectNames` + `detectPHI` (shown to the user as flags) -> `sanitize()` (always-redact names in any case, then `redactNames`, then `redactPHI` when the Safe Harbor toggle is on) -> `buildPrompt` -> `callGroq` -> `scrubText` -> `redactNames` again on the output. Revisions (`revise()`) resend the stored de-identified prompt plus the current draft, which is de-identified again first because the Writer may have typed into it.

Intake, Dx Justification and Treatment Plan tabs: their free-text fields go through `makeSanitizer` (in `PN_LIB`), which detects names and PHI across all fields at once, honors the allowlist and Safe Harbor toggle from `App` (passed as the `privacy` prop), and skips words from `DX_DATABASE` diagnosis names. Fixed option labels (MSE selects, modality, referrals, DSM criteria text) are sent as-is. Output gets `scrubText` and `redactNames`, and `RedactionFlags` shows what was removed. Any new tab that calls `callGroq` must do the same.

## Running locally

No build. React and ReactDOM load as production UMD builds with SRI hashes; the two `<script type="text/babel" data-presets="react">` blocks compile with the react preset only (no env transform), so a `const` used before its declaration throws at runtime. Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open `http://localhost:8000/`. It needs network access to unpkg (React, ReactDOM, Babel standalone, pinned with SRI hashes), Google Fonts, and `api.groq.com`. Set a Groq key from the top bar ("Set Groq key"); get one at console.groq.com.

## Testing

```
npm install   # dev-only: @babel/standalone
npm test      # or: node scripts/check.mjs path/to/file.html
```

`scripts/check.mjs` compiles every JSX block and runs the redaction and buzzword-scrub functions from `window.PN_LIB` against placeholder samples. Add a case there whenever you change `PHI_PATTERNS`, `detectNames`, `redactNames`, `makeSanitizer`, `COMMON_WORDS` or `scrubText`.

For UI changes, also load the page in a browser and click through all tabs with the console open. In a sandbox without unpkg access, Playwright can serve the libraries from `node_modules` (`react@18.3.1` and `react-dom@18.3.1` `umd/*.production.min.js`, `@babel/standalone@7.29.0`) via `page.route`. Hidden tabs stay in the DOM, so target `:visible` elements.

## Deploying

Merging to `main` publishes via GitHub Pages. Work on a branch and open a PR into `main`; don't hand the owner a file to upload unless they ask. Before starting, merge `origin/main` into your branch so you have the owner's latest `index.html` (it holds the item wording). Never replace `index.html` wholesale with an older copy, which would drop the wording. Earlier sessions could not push, so the owner uploaded `index.html` through the GitHub web editor; on 2026-10-06 an upload broke the live site because pasted items wrapped onto several lines, which `npm test` now catches.

## Lessons from past sessions

- **Check billing codes against the current code set, not memory.** ICD-10-CM changes every October 1; in FY2024 the eating-disorder codes were split by severity and the old 4-character codes stopped being billable. The ICD-10 connector (`validate_code`, `search_codes`) answers this in seconds. `npm test` rejects known header-only codes in `DX_DATABASE`.
- **One debounce timer per field.** `GoalCard` once shared one timer across text fields, so typing in a second field cancelled the first field's save. Browser tests caught it; unit tests could not.
- **Playwright selectors: the first visible textarea is not always the content box.** The Note settings card has a signature textarea above it. Target fields by placeholder or label.
- **Keep the Groq model pinned.** The app used to pick the model with the largest context window from `/models`. On 2026-10-09 that became `minimaxai/minimax-m2.7`, a preview, Enterprise-only reasoning model, and every generation failed, which looked like a broken API key. When Groq deprecates the pinned model, swap `GROQ_MODEL` for a current *production* chat model from console.groq.com/docs/models.
- **Risk is never silently omitted.** If the risk card is empty the app asks first, then writes "risk was not assessed" rather than leaving risk out of the note.
