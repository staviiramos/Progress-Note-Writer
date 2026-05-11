# Handoff: Progress Note Writer

A privacy-first, AI-assisted clinical progress note authoring tool for licensed mental-health clinicians. The Writer (therapist) inputs unstructured session details; the tool produces a formatted, de-identified, AI-buzzword-free progress note in the chosen documentation format.

---

## About the Design Files

The files in this bundle are **design references created as an HTML prototype** — they demonstrate intended look, behavior, copy, and interaction patterns. They are NOT production code to copy directly.

Your task is to **recreate this design in the target codebase's environment** (React/Next.js, Vue, SwiftUI, etc.) using its established libraries, state management, and design patterns. If no codebase exists yet, the recommended stack is **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** for the web, or **Electron/Tauri** if a desktop app is desired (preferable for HIPAA workflows since no PHI traverses a server).

The prototype uses inline Babel JSX, a small utility `lib.js`, plain CSS with custom properties, and a single `window.claude.complete()` call for AI generation. In production these should be replaced with: a real component framework, server-side or local LLM calls with proper auth, and a real design-token system.

## Fidelity

**High-fidelity.** Final colors, type, spacing, copy, and interactions are deliberate. Recreate pixel-perfectly using the codebase's existing libraries.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR  ── brand / HIPAA badge / autosave indicator   │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│   SIDEBAR        │   MAIN (paper-styled note view)      │
│   (inputs)       │                                      │
│   scrollable     │   ── note toolbar (copy / done)      │
│                  │   ── redaction flag bar              │
│                  │   ── rendered note on "paper"        │
│                  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

The sidebar is the only input surface. The right panel is read-only output. Generation is gated — a completed note must be explicitly marked "completed" (which wipes all state) before a new one can be generated.

---

## Screens / Views

There is one primary screen with two panels and one modal.

### 1. Sidebar — Inputs

Width: `minmax(380px, 460px)` on desktop. Stacks above the note pane at `< 900px`.

Contains the following cards in order. Each is a `border: 1px solid var(--line)` panel with `padding: var(--pad)` and `border-radius: var(--r)` (10px).

#### 1a. Subject & Format
- **Subject toggle**: segmented control — *Client* / *Patient*. Default: Client. This token is substituted into the note and used as the redaction placeholder for names.
- **Note format**: dropdown — SOAP / DAP / BIRP / GIRP / PIRP / EMR One-Paragraph / Narrative.

#### 1b. Clinical tone (3-step)
Three UI presentations selectable via Tweaks:
- *Segmented* (default): three buttons side-by-side
- *Slider dial*: a custom-styled range slider with three tick stops
- *Stacked cards*: three vertical cards with longer descriptions

Values: `Conversational` / `Balanced` / `Highly Clinical`. Default: Balanced.

#### 1c. Writer's voice (optional)
- Toggle: on/off (default off)
- When on: a textarea labeled "Paste 1–3 short examples of your past notes"
- Slider: voice-preservation strength 0–100 (default 60)

The voice sample is included in the generation prompt; the model is instructed to mirror sentence rhythm, formality, and signature phrases without inventing biographical content.

#### 1d. Session content (tabbed)
Three input modes via a tab control:
- **Free-text** (default): single large textarea
- **Structured fields**: separate textareas for Presenting issue, Interventions used, Client/Patient response, Plan / homework
- **Bullet shorthand**: textarea with monospace font; bullets expanded into prose during generation

Only the active tab's content is included in generation.

#### 1e. Names to redact
- Comma-separated input
- Auto-detection chips: capitalized words mid-sentence are surfaced as suggestions to add
- All matches replaced with the chosen subject token ("Client" / "Patient"), no brackets

#### 1f. Interventions (chip cloud)
Pressable chips: CBT, DBT, ACT, MI, Psychodynamic, IFS, EMDR, Somatic, Solution-Focused, Narrative therapy, Mindfulness, Behavioral activation, Exposure, Cognitive restructuring, Validation, Psychoeducation. Multi-select.

Plus an **"Other (not listed)"** text input for comma-separated entries. Header count reflects pressed chips + parsed "other" entries.

#### 1g. Risk assessment
Rows for: Suicidal ideation, Homicidal ideation, Self-harm, Substance use, Aggression. Each row: tri-state control (Denied / Endorsed / Active) — **all default to unset/null**. An optional detail textarea appears when Endorsed or Active is selected.

Only rows the Writer touches are included in the note. If nothing is set, no risk section appears at all.

#### 1h. Mental Status Exam (quick-fill)
10 fields as a 2-column grid (1-column on mobile): Appearance, Behavior, Speech, Mood, Affect, Thought process, Thought content, Cognition, Insight, Judgment. Each is a dropdown of common presets ("Appropriate", "Cooperative", "Normal rate/rhythm", etc.) plus a free-text option.

Empty fields are excluded from the note.

#### 1i. HIPAA / Privacy card
Two columns explaining: Safe Harbor de-identification runs locally before any text leaves the device; the 18 HIPAA identifier categories are tokenized (`[PHONE-REDACTED]`, `[DATE-REDACTED]`, etc.); drafts are in-memory only; Writer is responsible for confirming a BAA with the AI provider.

Includes a master toggle: "Apply Safe Harbor de-identification" (default ON). Off only for fully BAA-covered environments.

### 2. Main — Note pane

Width: 1fr. Stacks below the sidebar on mobile.

- **Note toolbar**: left side shows format name + word count + redaction count. Right side: *Copy to clipboard* and *Note completed* (danger color). Stacks vertically on mobile.
- **Redaction flag bar**: above the paper. Shows category-grouped chips of every redaction applied (e.g., "3 names · 1 phone · 2 dates"). Hidden if nothing was redacted.
- **Paper**: serif-set rendered note. Padding 56px desktop, 32px tablet, 24px mobile. Box shadow simulates lifted paper. Section headings (per format) styled as small-caps headers above each block.

When no note exists, an empty state displays: "Fill in the panel and press *Generate note* to see the draft here."

### 3. Generate button
Sticky-bottom in the sidebar. Disabled while a note is already on the paper — the Writer must mark the current note completed (wiping all state) before generating a new one.

### 4. "Note completed" confirmation modal
Triggered by the danger-colored *Note completed* button. Title: "Erase everything?". Body explains the wipe is permanent and reminds the Writer to copy the note into their record first. Two buttons: *Cancel* (neutral) and *Yes, erase permanently* (danger). On mobile, buttons stack column-reverse and go full-width.

### 5. Tweaks panel
Floating bottom-right panel. Three sections:
- **Visual**: Color theme (Warm / Cool / Sage / Graphite) as swatch radios
- **Density**: Compact / Comfortable / Spacious
- **Tone scale style**: Segmented / Slider dial / Stacked cards

---

## Interactions & Behavior

### Generation pipeline
1. **Pre-redact**: input is run through Safe Harbor regex (names, SSN, phones, emails, URLs, IPs, dates, ZIPs, MRN/account/chart numbers, ages ≥ 90). Names from the redact field are also stripped.
2. **Prompt assembly**: format spec, tone, optional voice sample + preservation strength, session content, selected interventions, only-touched risk rows, only-filled MSE fields, banned-word list.
3. **LLM call**: `claude-haiku-4-5` via `window.claude.complete()` in the prototype. In production: your hosted endpoint with a BAA. Token cap ~1024.
4. **Post-process scrubber**: strips em-dashes (—), en-dashes (–), curly quotes (" " ' '). Substitutes AI tells:
   - delve → explore
   - navigate → manage / address
   - tapestry → set
   - underscore → emphasize
   - "It is important to note that…" → removed
   - moreover / furthermore → also / additionally (context-dependent)
   - plethora / myriad → many
   - leverage → use
   - harness → use
   - dive deep → examine
   - realm of / landscape of → in / among
5. **Second redaction pass**: re-scans output for any leaked identifiers and replaces them.
6. **Render** on the paper.

### Generate gating
- Generate button is disabled when a note is already on the paper
- Must press *Note completed* and confirm to clear state and re-enable

### State erasure (Note completed flow)
Wipes: rendered note, all input fields, voice sample, intervention chips, risk rows, MSE fields, redaction list. Topbar autosave indicator remains "Nothing saved · in-memory only".

### No persistence
- No localStorage writes anywhere
- On load, any legacy drafts in localStorage are removed (defensive cleanup)
- Refreshing the page loses everything

### Responsive behavior
- `≥ 1100px`: full two-column layout
- `900–1100px`: trimmed paper padding, sidebar narrowed
- `< 900px`: single column, sidebar stacks above note. Sticky "Jump to note" pill appears bottom-right linking to `#note-pane`. Note toolbar stacks vertically with full-width buttons
- `< 560px`: tighter padding, single-column MSE, larger touch targets (40px+ inputs, 36px+ controls), risk rows stack, modal buttons go full-width column-reverse

### Animations
- All transitions: `cubic-bezier(.2, .8, .25, 1)` over 180ms
- Card hover: `transform: translateY(-1px)` + slightly stronger shadow
- Toggle thumb: 180ms slide
- Modal: 200ms scale + fade

---

## State Management

```ts
type AppState = {
  // Inputs
  subject: 'Client' | 'Patient'
  format: 'soap' | 'dap' | 'birp' | 'girp' | 'pirp' | 'emr' | 'narrative'
  tone: 'conversational' | 'balanced' | 'clinical'

  voiceOn: boolean
  voiceSample: string
  voiceStrength: number  // 0-100

  inputMode: 'freetext' | 'structured' | 'bullets'
  freetext: string
  structured: { presenting: string; interventions: string; response: string; plan: string }
  bullets: string

  namesToRedact: string  // comma-separated
  interventionsSelected: Set<string>
  interventionsOther: string

  risk: Record<RiskCategory, 'denied' | 'endorsed' | 'active' | null>
  riskDetails: Record<RiskCategory, string>

  mse: Record<MSEField, string>

  safeHarborOn: boolean

  // Output
  note: string | null
  redactionsApplied: Record<RedactionCategory, number>
  generating: boolean

  // Modal
  confirmingErase: boolean

  // Tweaks
  theme: 'warm' | 'cool' | 'sage' | 'graphite'
  density: 'compact' | 'comfy' | 'spacious'
  toneStyle: 'segmented' | 'slider' | 'stacked'
}
```

Use whatever state primitive the codebase prefers (React state + context, Zustand, Redux Toolkit, signals, etc.). The current prototype uses `useState` + prop drilling — fine for a single-screen app of this size; promote to a store if features grow.

---

## Design Tokens

### Colors (Warm theme — default)
| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(96% 0.012 75)` | App background |
| `--bg-2` | `oklch(94.5% 0.014 75)` | Topbar / hover |
| `--paper` | `oklch(98.5% 0.008 80)` | Paper note background |
| `--ink` | `oklch(22% 0.012 60)` | Primary text |
| `--ink-2` | `oklch(36% 0.012 60)` | Secondary text |
| `--muted` | `oklch(52% 0.012 60)` | Captions, helper text |
| `--line` | `oklch(86% 0.018 75)` | Borders |
| `--line-2` | `oklch(80% 0.022 75)` | Hover borders |
| `--accent` | `oklch(48% 0.085 35)` | Primary action, brand mark |
| `--accent-soft` | `oklch(92% 0.035 35)` | Accent backgrounds, badges |
| `--warn` | `oklch(56% 0.13 55)` | Warning states |
| `--danger` | `oklch(50% 0.16 25)` | Destructive actions |
| `--ok` | `oklch(48% 0.09 145)` | Success / confirmed states |

Alternate themes (Cool, Sage, Graphite) shift the chroma and hue of bg/paper/line/accent. See `styles.css` `html.theme-*` blocks for exact values.

### Typography
| Token | Stack |
|---|---|
| `--serif` | `'Newsreader', 'Source Serif 4', Georgia, serif` |
| `--sans` | `'Helvetica Neue', Helvetica, system-ui, sans-serif` |
| `--mono` | `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace` |

Scale:
- Note body (serif on paper): 16px / 1.6
- UI body (sans): 14px / 1.5
- Section headings: 13.5px sans, uppercase letter-spaced 0.04em
- Note section headings (small caps): 13px serif, letter-spaced 0.08em, color `--ink-2`
- Brand: 18px serif, weight 500, letter-spacing -0.01em
- Helpers: 11.5px sans, color `--muted`

### Spacing & shape
| Token | Default | Compact | Comfy |
|---|---|---|---|
| `--pad` | 16px | 12px | 20px |
| `--gap` | 14px | 10px | 18px |
| `--r` | 10px | — | — |
| `--r-sm` | 7px | — | — |

### Shadows
- `--shadow-sm`: inset 0 1px 0 white/.6, 0 1px 2px ink/.04
- `--shadow-md`: inset 0 1px 0 white/.6, 0 6px 24px ink/.07
- `--shadow-paper`: layered — inset white, near shadow, far drop, soft ambient

---

## Assets

- **Fonts**: Newsreader (serif) and JetBrains Mono via Google Fonts. Sans uses system stack.
- **Icons**: All icons are inline SVG in `app.jsx` (small library at top of file). No icon library is used. In a real codebase, swap to Lucide or Phosphor and match stroke-width 1.5.
- **Brand mark**: a single accent-colored circle with an inset paper-colored ring. Replace with a real logo once one exists.

---

## Banned-word / AI-tell scrubber

The post-generation scrubber strips both punctuation and lexical AI-tells. Keep the full list in a config file in production — clinicians will want to tune it. Current entries:

**Punctuation**: em-dash, en-dash, curly quotes (single + double)

**Words / phrases**:
delve, navigate (→ manage/address), tapestry, underscore (→ emphasize), "It is important to note that", moreover, furthermore, plethora, myriad, leverage, harness, "dive deep", "realm of", "landscape of"

Verify each substitution preserves clinical meaning — "navigate" in particular has both AI-tell and legitimate clinical uses (e.g., "navigate a custody dispute"). Consider contextual replacement rather than blanket substitution in v2.

---

## HIPAA & compliance notes

The prototype is positioned as a **de-identification + drafting aid**, not a PHI-handling system. Production decisions:

- If staying client-only (recommended for v1): ship as a desktop app (Tauri/Electron) or PWA. No server, no storage, no BAA strictly required for the app itself — but the LLM provider does need one if any identifiable data could leak past the Safe Harbor scrubber.
- If adding sync / multi-device / team features: full HIPAA compliance work is required (BAA-covered hosting, audit logging, encryption at rest, breach notification, access controls, the works). Budget 2–3 months minimum.

Either way, the LLM provider must be BAA-covered. Anthropic, OpenAI (enterprise), Azure OpenAI, and AWS Bedrock all offer BAAs. The Safe Harbor pass is defense-in-depth, not a substitute.

---

## Files in this bundle

- `Progress Note Writer.html` — entry point, loads scripts
- `app.jsx` — main React component tree, all UI
- `lib.js` — format specs, scrubber, Safe Harbor regex, prompt builder
- `styles.css` — all styling, including theme variants and responsive rules
- `tweaks-panel.jsx` — floating tweaks UI (can be discarded in production; included for reference)
- `README.md` — this file

---

## Recommended implementation order

1. **Scaffold** with chosen framework + design tokens. Match colors and type before any features.
2. **Build the sidebar inputs** as dumb controlled components. Wire local state. No AI yet.
3. **Build the paper output area** with a sample hard-coded note to validate typography.
4. **Implement the Safe Harbor scrubber** as a standalone, unit-tested module. Cover the 18 identifier categories.
5. **Wire the LLM call** behind a service interface. Mock first; swap to real provider later.
6. **Post-process scrubber** as another isolated, tested module.
7. **Generate gating + erase flow + confirmation modal.**
8. **Responsive pass** — verify at 390 / 768 / 1024 / 1440 widths.
9. **Tweaks panel** is optional in v1; theme/density preferences can move to a real settings screen.

---

## Open questions to resolve before shipping

- Multi-clinician accounts? (changes the architecture significantly)
- EHR integration? (SimplePractice, TheraNest, Headway, etc. all have APIs)
- Insurance billing code (CPT) suggestions inside the note?
- Audit log requirement? (often a compliance ask even without PHI persistence)
- Branding / naming (the current label is descriptive, not a product name)

Coordinate with the user before building any of these.
