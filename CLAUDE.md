# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-first, browser-only tool that helps licensed mental-health clinicians write de-identified documentation. It has three modes, picked with tabs in the top bar:

- **Progress Note**: SOAP, DAP, BIRP, GIRP, PIRP, EMR one-paragraph, or Narrative.
- **Intake Assessment**
- **Dx Justification**: walks through DSM-5-TR criteria checklists for each ICD-10 code.

The clinician is always called "Writer", and the subject is called "Client" or "Patient".

## The live app is `index.html`, and nothing else

`index.html` is a **self-contained single file**. It inlines all CSS and JS and has no build step, no package.json, no tests, and no linter. All development over the last stretch of commits has happened only in this file.

The other source files are **stale snapshots** from the original Claude Design handoff (May 2026). Don't edit them expecting the app to change, and don't treat them as a reference for current behavior:

- `app.jsx`, `lib.js`, `styles.css`, and `tweaks-panel.jsx` at the root
- the same files under `project/` and `project/design_handoff_progress_note_writer/`

For example, the root `app.jsx` still calls the Anthropic API and has no Intake or Dx modes. `project/design_handoff_progress_note_writer/README.md` and `chats/chat1.md` are still useful for **design intent**: visual spec, copy, and the generation pipeline. The top-level `README.md` is the original handoff boilerplate.

### Running it

Open `index.html` in a browser, or serve the directory with `python3 -m http.server`. React 18, ReactDOM, and `@babel/standalone` load from unpkg using SRI hashes, and JSX is transpiled in the browser. A Groq API key is needed to generate anything.

## Layout of `index.html` (approximate line ranges)

1. **`<style>`** (~1–570): every app style. Theme, density, and color tokens are CSS custom properties.
2. **Plain `<script>` defining `window.PN_LIB`** (~577–1450): framework-free domain logic.
   - `FORMATS`, `TONES`, `CONCISENESS`, `INTERVENTIONS`, `MSE_FIELDS`, `RISK_ITEMS`
   - `PHI_PATTERNS` with `detectPHI` / `redactPHI`: regex-based HIPAA Safe Harbor redaction.
   - `detectNames` / `redactNames`: names are replaced with the subject token, without brackets. A user allowlist suppresses false positives.
   - `AI_BUZZWORDS`, `BUZZWORD_REPLACE`, `scrubText`: the post-generation scrubber. It strips em/en dashes and curly quotes, and replaces AI-sounding words such as delve, navigate, tapestry, and underscore.
   - Prompt builders: `buildPrompt` (progress note), `buildIntakePrompt`, and `buildDxPrompt`. `parseNote` splits model output into format sections.
   - `DX_DATABASE`: ICD-10 codes, each with DSM-5-TR criterion groups (`{label, note, min, criteria[]}`). Shared groups such as `_MDD_GROUPS` are reused across related codes.
3. **`<script type="text/babel">` with the tweaks panel** (~1455–1645): theme, density, and tone-control style.
4. **`<script type="text/babel">` with the React app** (~1647–end). It gets the domain logic through `const L = window.PN_LIB`.
   - `pickGroqModel` / `callGroq`: the only LLM integration. It calls `api.groq.com/openai/v1` directly from the browser, picks a model automatically from `/models`, and skips reasoning, vision, and guard models via a `SKIP` regex. It caches the choice in memory only, strips `<think>` tags, and maps API errors to messages for the user.
   - `IntakeTab` and `DxTab` are self-contained components. Progress-note state lives in `App`.

## Pipeline and invariants to preserve

Generation follows this order: pre-redact the input (PHI regex plus names) → build the prompt → `callGroq` → `scrubText` → run a second redaction pass over the output → render.

- Generation is **gated**. After a note is shown, Generate stays disabled until the Writer clicks "Note completed" and confirms. Confirming wipes all state, including the `pn.drafts` localStorage key.
- **localStorage keys:**
  - `pn.apikey` holds the Groq key.
  - `pn.allowlist` holds name-detection exceptions.
  - `pn.drafts` and `pn.groqmodel` are legacy keys and are only ever *removed*.
  - The model choice is intentionally kept in memory only, so it resets on refresh. Don't persist note content.
- Optional sections (risk rows, MSE fields) go into the prompt only when the Writer has filled them in.
- Keep generated-text rules consistent across all three prompt builders: no em dashes, no buzzwords, and no inventing clinical details that weren't in the input.

# Reasoning & Execution
- **Chain of Thought:** Always think through problems and tasks step-by-step before giving your final answer or generating code.
