# Progress Note Writer

A browser tool that helps licensed mental-health clinicians draft de-identified documentation (progress notes, intake assessments, diagnosis justifications, treatment plans) from their own session notes. The clinician is referred to as "Writer"; the person served is "Client" or "Patient" (user's choice).

Live site: GitHub Pages from `main` (`staviiramos.github.io/Progress-Note-Writer/`).

Start every session by reading `HANDOFF.md` for current state and open work.

## Ground rules (from the project owner; do not relax these)

- **One file.** The whole app is `index.html`: React 18 + Babel standalone loaded from unpkg, JSX transformed in the browser, no build step. Keep it a single file unless the owner asks to split it.
- **Privacy first.** Name and PHI redaction (HIPAA Safe Harbor identifiers, plus the user's allowlist) runs on-device *before* anything is sent to the model. Never weaken or bypass it. Never store notes: note content lives in React state only. The only things in `localStorage` are `pn.apikey` and `pn.allowlist` (`pn.drafts` and `pn.groqmodel` are legacy keys that the app only removes).
- **Model provider is Groq**, with a key the user pastes into the app. Never hardcode a key, and never put one in the repo, a commit, or a prompt.
- **Neutral wording and placeholder data.** Use clinical, neutral language and obviously fake sample data (no realistic case details) in prompts, tests, fixtures and handoffs. Long handoffs go in a file. A past session lost work because long outputs containing detailed risk-assessment content were stopped by a content filter, so for clinical instruments describe structure and scoring in summary form and keep long item text out of chat output.
- **Test redaction changes** against sample inputs (`npm test`) before calling them done.
- **No AI-style prose in generated notes.** `scrubText` strips em dashes and buzzwords ("delve", "navigate", "tapestry", "underscore", "moreover", ...). Keep that behavior.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | **The app.** Everything that ships. |
| `CLAUDE.md`, `HANDOFF.md` | Agent instructions and current-state handoff. |
| `scripts/check.mjs`, `package.json` | Dev-only offline checks (`npm test`). Not loaded by the app. |
| `handoff/index.wip-screenings.html` | Recovered in-progress version of `index.html` (see `HANDOFF.md`). Reference only; not served by the app. |
| `README.md`, `chats/`, `project/`, root `app.jsx`, `lib.js`, `styles.css`, `tweaks-panel.jsx` | The original Claude Design prototype bundle from May 2026. Historical reference only; `index.html` has moved well past it and does not load these files. The README there was written for a different workflow, so don't follow its "recreate in Next.js" instructions. |

## How `index.html` is organized

Line numbers drift; search for the names below.

1. **`<style>`** (top of file, ~650 lines): design tokens on `:root` (warm paper palette, `--serif` Newsreader, `--sans`), theme/density variants, then per-tab sections (`/* Screenings tab */`, intake, dx, goal cards, ...).
2. **`<script>` with `window.PN_LIB`** (plain JS, marked `═══ lib.js ═══`): pure logic, no React.
   - Config: `FORMATS` (SOAP, DAP, BIRP, GIRP, PIRP, EMR one-paragraph, narrative), `TONES` (conversational / balanced / clinical), `CONCISENESS`, `INTERVENTIONS`, `MSE_FIELDS`, `RISK_ITEMS`.
   - Redaction: `PHI_PATTERNS`, `detectPHI`, `redactPHI` (SSN, phone, email, URL, IP, dates, ZIP, MRN-style IDs, age 90+), `COMMON_WORDS`, `detectNames` (capitalized words not at sentence start, minus common words and the allowlist), `redactNames` (replaces with the subject label), `makeSanitizer` (multi-field helper used by the Intake, Dx and Treatment Plan tabs).
   - Output cleanup: `AI_BUZZWORDS`, `BUZZWORD_REPLACE`, `scrubText`.
   - Prompt builders: `buildPrompt` (progress note), `buildIntakePrompt`, `buildDxPrompt`; `parseNote` splits model output into format sections.
   - `DX_DATABASE`: diagnosis list with criteria groups used by the Dx tab.
3. **`<script type="text/babel">` tweaks panel** (`═══ tweaks-panel.jsx ═══`): floating appearance panel (`useTweaks`, `TweaksPanel`, `TweakRadio`, ...).
4. **`<script type="text/babel">` app** (`═══ app.jsx ═══`):
   - `pickGroqModel` / `callGroq`: lists Groq models, skips reasoning/vision/audio models, picks the largest context window, posts to `https://api.groq.com/openai/v1/chat/completions`, strips `<think>` blocks.
   - Shared UI: `useToast`, tone controls, `ApiKeyModal`, `AllowlistEditor`, `useSpeechRecognition` (browser dictation), `fmtTime12`.
   - Screenings: `scoreSeverity`, `SCREENING_TOOLS` (PHQ-9, GAD-7, PCL-5, ASRS-v1.1; the ASRS item wording goes in the marked `ASRS_ITEM_TEXT` constant and its scoring is `PN_LIB.scoreASRS`), `ScreeningTool`, `ScreeningsTab`.
   - Safety plan: `SAFETY_PLAN_STEPS`, `safetyPlanEntries`, `safetyPlanToLines`, `SafetyPlanTab`.
   - Tabs: `TreatmentPlanTab` (+ `GoalCard`), `IntakeTab` (+ `DxAutocompleteInput`), `DxTab` (+ `SxItem`).
   - `App`: top bar with tab switcher (`appMode`: `progress`, `intake`, `dx`, `plan`, `screenings`, `safety`), Progress Note sidebar and paper-style output, API key handling, app-level state shared across tabs (`screeningAnswers` -> `screeningLines`, `safetyPlan` -> `safetyPlanItems`, `goals`), `generate()` for the progress note, and `wipeAll()` ("mark completed" clears everything).

Conventions worth keeping:
- Define components at module level, not inside other components, so inputs don't remount and lose focus. Use `React.memo`, `useCallback` and refs for stable props (see `GoalCard`, `SxItem`).
- Data flows into prompts as arrays of short lines (`screeningLines`, active goals). New cross-tab data should follow the same pattern: App-level state, a `useMemo` that formats lines, passed as a prop to each tab's generate call.

## Privacy data flow

Progress Note tab: `rawInput` -> `detectNames` + `detectPHI` (shown to the user as flags) -> `sanitize()` (`redactNames`, then `redactPHI` when the Safe Harbor toggle is on) -> `buildPrompt` -> `callGroq` -> `scrubText` -> `redactNames` again on the output.

Intake, Dx Justification and Treatment Plan tabs: their free-text fields go through `makeSanitizer` (in `PN_LIB`), which detects names and PHI across all fields at once, honors the allowlist and Safe Harbor toggle from `App` (passed as the `privacy` prop), and skips words from `DX_DATABASE` diagnosis names. Fixed option labels (MSE selects, modality, referrals, DSM criteria text) are sent as-is. Output gets `scrubText` and `redactNames`, and `RedactionFlags` shows what was removed. Any new tab that calls `callGroq` must do the same.

## Running locally

No build. Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open `http://localhost:8000/`. It needs network access to unpkg (React, ReactDOM, Babel standalone, pinned with SRI hashes), Google Fonts, and `api.groq.com`. Set a Groq key from the top bar ("Set Groq key"); get one at console.groq.com.

## Testing

```
npm install   # dev-only: @babel/standalone
npm test      # or: node scripts/check.mjs path/to/file.html
```

`scripts/check.mjs` compiles every JSX block and runs the redaction and buzzword-scrub functions from `window.PN_LIB` against placeholder samples. Add a case there whenever you change `PHI_PATTERNS`, `detectNames`, `redactNames`, `makeSanitizer`, `COMMON_WORDS` or `scrubText`.

For UI changes, also load the page in a browser and click through all tabs with the console open. In a sandbox without unpkg access, Playwright can serve the libraries from `node_modules` (`react@18.3.1`, `react-dom@18.3.1`, `@babel/standalone@7.29.0`) via `page.route`.

## Deploying

Merging to `main` publishes via GitHub Pages. Earlier cloud sessions could not push, so the owner uploaded `index.html` through the GitHub web editor; if `git push` works in your environment, use a branch and PR instead.
