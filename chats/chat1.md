# Therapy Note Generator

_Started 2026-05-11 13:33 UTC_

---

## User

I want to create a tool that can be used to write De-Identified Psychotherapy progress notes. The user should be able to choose the level of clinical tone to the note, as well as the option to maintain their own voice. There should be options to choose for the format of the note (e.g., SOAP, EMR One Paragraph Note, etc) consisting of the most commonly used formats. It should be free of any AI obvious grammar, such as the infamous "-". The therapist should be mentioned as "Writer." There should also be an option to refer to the subject as "Client" or "Patient"

## Assistant

_[tool: questions_v2]_

Before I build, a few quick questions to make sure I design the right tool.

## User

Questions answered:
- formats: SOAP (Subjective, Objective, Assessment, Plan), DAP (Data, Assessment, Plan), BIRP (Behavior, Intervention, Response, Plan), GIRP (Goal, Intervention, Response, Plan), PIRP (Problem, Intervention, Response, Plan), EMR One-Paragraph Note, Narrative / Free-form
- tone_levels: 3-step (Conversational / Balanced / Highly Clinical)
- input_method: Free-text session summary they type, Structured prompts (presenting issue, interventions, response, etc.), Bullet/shorthand notes to expand
- ai_generation: Generate the note (uses AI in-page)
- voice_capture: All of the above
- deident_strictness: Only names should be removed.
- extras: Risk assessment checkboxes (SI/HI, etc.), Intervention library (CBT, DBT, ACT, MI, psychodynamic, etc.), Mental Status Exam quick-fill, Copy-to-clipboard with formatted output, Save drafts locally
- banned_chars: Em-dashes (—), "Delve", "navigate", "tapestry", "underscore" and similar AI buzzwords
- aesthetic: Calm clinical (soft warm neutrals, serif accents, paper-like)
- variations: Color theme, Density (compact / comfortable / spacious), Tone scale style

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

Great answers. Building this now — calm clinical paper aesthetic, split layout: inputs on the left, generated note on the right. Helvetica + Newsreader for the serif accent.

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

Now I'll build the main HTML, styles, and React app.

_[tool: snip]_

_[tool: snip]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

Built — a calm clinical, paper-aesthetic Progress Note Writer in **Progress Note Writer.html**.

**Left panel (inputs):**
- Format: SOAP, DAP, BIRP, GIRP, PIRP, EMR One-Paragraph, Narrative
- Subject toggle: Client / Patient (and the therapist is always referred to as "Writer")
- Clinical tone: 3-step (Conversational / Balanced / Highly Clinical)
- Writer's voice: toggle on, slider for preservation strength, paste a sample
- Session content: tabs for Free-text / Structured fields / Bullet shorthand
- Names to redact: explicit list + auto-detection of capitalized mid-sentence names
- Interventions chip cloud (CBT, DBT, ACT, MI, etc.)
- Risk assessment: SI / HI / Self-harm / Substance / Aggression — Denied / Endorsed / Active with optional detail
- MSE quick-fill: 10 fields with sensible presets

**Right panel (output):**
- Serif-set "paper" note with proper section headings per format
- Flag bar showing every name that was redacted
- Copy to clipboard, Save draft (localStorage, up to 12), load/delete drafts

**Post-processing pipeline runs on every generation:**
1. Pre-redact names in the prompt input
2. AI generates per format + tone + voice
3. Scrubber strips em-dashes, en-dashes, curly quotes
4. Replaces AI tells: delve → explore, navigate → manage/address, tapestry, underscore, "It is important to note that…", moreover, furthermore, plethora, myriad, leverage, harness, dive deep, realm of, landscape of, etc.
5. Final name-redact pass on the output

**Tweaks** (top-right toggle): four color themes (Warm, Cool, Sage, Graphite), three densities, and three tone-scale UI styles (segmented, slider dial, stacked cards) so you can compare which feels best.

Drafts persist locally; no PHI ever leaves the page beyond the generation call.

## User

What are those 3 bubbles for "SOAP" "Client" and "Balanced."? That doesn't seem necessary with the options on the side panel. Also I dont see the point of "Names to Redact," as all PHI should be redacted, except for dates or places etc, unless otherwise specified.

## Assistant

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

Done — removed the SOAP/Client/Balanced pills from the output toolbar (those settings are already in the side panel) and dropped the "Names to redact" input. Names in your input are auto-detected and replaced with [Client] or [Patient] before generation; everything else stays unless you write it differently.

## User

Also, Any side panel not filled-in is assumed it is not needed for the note and not be used. For example ,the mental status exam may not always be used. If it is not filled in, the resource should assume that the information should not be included

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

Done. The prompt now respects what you actually fill in:

- **MSE** — only filled cells get included; if nothing's selected, no MSE section appears
- **Interventions** — only listed if at least one chip is pressed
- **Risk assessment** — now defaults to nothing selected (no item is pre-marked "Denied"). Only items you actively click Denied/Endorsed/Active show up. If you don't touch the panel at all, the note skips risk entirely
- **Voice sample** — only used when the toggle is on AND a sample is pasted
- **Structured fields** — empty fields are skipped

Side panels are treated as additive context. Leave it blank, it stays out of the note.

## User

Under interventions, there should be an "Other" option where the writer can add an intervention that may not be listed.

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

Added an "Other (not listed)" text field under the Interventions chips. Comma-separated entries are merged into the intervention list passed to the prompt, and the count in the header reflects them.

## User

This resource should be HIPAA compliant based on the most updated guidelines for AI utilization for note writing

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: snip]_

Tightened up to align with current HIPAA / AI-in-clinical-documentation guidance:

- **Safe Harbor de-identification** runs on-device before any text leaves the page. Detects and redacts the 18 identifiers that are pattern-matchable: names, SSNs, phone numbers, emails, URLs, IP addresses, specific dates, ZIPs, MRN/account/chart numbers, and ages 90+. Each gets tokenized (`[PHONE-REDACTED]`, `[DATE-REDACTED]`, etc.).
- **Flag bar** above the note shows every redaction grouped by category, so you can verify what got caught.
- **Prompt-level guardrails** tell the model to preserve redaction tokens verbatim and never reconstruct them.
- **Privacy card** in the sidebar makes the protections visible, with a toggle if a Writer is working in a fully de-identified BAA-covered environment and wants to skip Safe Harbor.
- **Topbar badge** flags the active posture.
- **Disclaimer** in the privacy card notes that drafts stay local and that the Writer is responsible for confirming a Business Associate Agreement with the AI provider before entering identifiable PHI. The tool reduces risk; final compliance always depends on the Writer's environment.

## User

"Names in your input are auto-detected and replaced with [Client] before generation. Dates, places, and other context remain unless you remove them." Should be updated as it should be replaced with the chosen "subject" option above, without "["and "]" around it. In terms of the safe harbor, I like that this should be toggled. No drafts of notes should be saved anywhere. Once the user confirms the note is completed, they must "wipe" the note from the resource before they can create a new one. There should be an option that says "Note Completed" or something like that. Once selected, it should inform the user if they are sure, as once selected the note will be permanently erased for privacy.

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: snip]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: snip]_

Done. Summary of changes:

- **Names now redact to the chosen subject without brackets** — input mentioning "Sarah" becomes "Client" or "Patient" depending on the toggle, both in the helper text and the actual redaction.
- **All draft saving removed.** No `localStorage` writes, no drafts list, no "Save draft" button. On load, the tool also wipes any legacy drafts that may have been stored from earlier sessions. Topbar now reads "Nothing saved · in-memory only".
- **"Note completed" button** replaces "Save draft" — styled in the danger color so it can't be confused with copy.
- **Confirmation modal** appears first: explains the wipe is permanent and reminds the Writer to copy the note into their record before continuing. Cancel keeps everything; "Yes, erase permanently" wipes the note plus every input field, voice sample, intervention selection, MSE entry, and risk flag.
- **Generate is locked** while a note is on screen — the Writer must mark it completed before starting a new one, enforcing the wipe-before-next-note rule.

## User

Make sure this is useable on mobile and on PC/MAC

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Mobile + desktop responsive layout is in. Key behaviors:

- **< 900px**: panels stack vertically, sidebar scrolls naturally with the page, note toolbar buttons go full-width
- **< 560px**: tighter padding, single-column MSE, larger touch targets (40px+ for inputs, buttons, segmented controls, toggles)
- **Mobile "Jump to note" pill** appears bottom-right so a long sidebar doesn't trap the Writer at the top
- **Risk rows** stack with full-width tri-state buttons on phones
- **Modal** becomes column-reversed full-width buttons on small screens
- Added `viewport-fit=cover` for notched devices

Desktop layouts (≥ 900px) are unchanged; an intermediate breakpoint at 1100px just trims paper padding for laptops.

## User

Verifier agent check completed

## Assistant

All clear — mobile and desktop layouts verified working.

## User

Ok looks great, whats the next step to get this created

## Assistant

Here's a practical path from this prototype to a shipped product:

**1. Validate with real clinicians (1–2 weeks)**
Get 5–8 therapists to walk through it with their own (de-identified) session memory. Watch where they hesitate. Cheaper than building the wrong thing.

**2. Lock down the compliance posture**
Decide which lane you're in — each has very different cost and timeline:
- *Tool-only, no PHI*: stays as-is. Marketed as a de-identification + drafting aid. No BAA needed because nothing identifiable leaves the device.
- *Full PHI workflow*: requires a HIPAA-covered LLM (Anthropic, OpenAI, Azure, AWS Bedrock all offer BAAs), a HIPAA-covered host, audit logging, and a privacy/security review. Plan on 2–3 months minimum.

**3. Pick the technical foundation**
- *Stay client-side*: cheapest path. The current architecture (no server, no storage) is genuinely defensible — wrap it as a desktop app (Tauri/Electron) or PWA, ship.
- *Add a backend*: only if you need accounts, billing, team features, or EHR integration. Start with Supabase or Convex + a HIPAA-compliant tier.

**4. Productionize the AI layer**
Replace `window.claude.complete` with a direct API call (your own key, your own BAA). Add retry/timeout handling, token budgeting, and a "regenerate just this section" affordance — clinicians always tweak one section, not the whole note.

**5. Branding + identity**
Name, logo, domain, landing page. The current "Progress Note Writer" is descriptive but unmemorable. This is a half-day exercise once you've validated demand.

**6. Pilot**
3–5 clinicians, free for 60 days, weekly check-ins. Measure: minutes saved per note, edit distance between generated and final note, % of notes actually used.

**7. Pricing + launch**
$30–60/mo per clinician is the going rate for note-assistance tools (Blueprint, Mentalyc, Upheal). Solo-practitioner self-serve is the easiest beachhead.

**The single most important next step**: step 1. Don't write another line of code until you've watched real therapists use this. Want me to draft a user-research script or a pilot landing page?

## User

No, do I share it with Claude code to get it created next?

## Assistant

_[tool: invoke_skill]_

Yes — there's a built-in handoff flow for exactly that. Let me load it.

_[tool: list_files]_

I'll build a handoff package you can share with Claude Code. Let me check the current files first to make sure the README is accurate.

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: copy_files]_

_[tool: present_fs_item_for_download]_

Download the zip above, then in Claude Code:

1. Unzip into the target repo (or a fresh folder if starting clean)
2. Open Claude Code in that directory
3. Prompt: *"Read `design_handoff_progress_note_writer/README.md` and the HTML prototype files. Implement this design in [your stack]."*

The README is self-contained — a developer who wasn't in this conversation can build from it alone.

Want screenshots of the design added to the bundle before you hand it off?

## User

Yes

## Assistant

_[tool: show_html]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: snip]_

_[tool: show_to_user]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: read_file]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: snip]_

_[tool: save_screenshot]_

_[tool: screenshot_user_view]_

_[tool: save_screenshot]_

_[tool: snip]_

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

_[tool: snip]_

_[tool: eval_js_user_view]_

_[tool: snip]_

_[tool: run_script]_

The handoff package is ready in the download card above. Live screenshot capture wasn't reliable in this environment, so I left a short note in `screenshots/README.md` explaining which states to capture (1440px desktop + 390px mobile, six key states listed) — drop the PNGs into that folder before zipping if you want them bundled. The README is self-contained enough that Claude Code can build from text alone.

