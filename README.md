# Progress Note Writer

A browser tool that helps licensed mental-health clinicians draft documentation from their own session notes:

- **Progress notes** in SOAP, DAP, BIRP, GIRP, PIRP, EMR one-paragraph or narrative format, with section-level editing and revision.
- **Intake assessments** (CPT 90791), **diagnosis justifications** and **treatment plan narratives**.
- **Screenings:** PHQ-9, GAD-7, PCL-5, ASRS-v1.1 and the C-SSRS screen. Completed results feed into generated notes.
- **Safety plan:** six-step plan that feeds notes and prints as a one-page client copy.
- **Letters:** referral, treatment summary, care coordination and attendance letters. Names and dates are filled in on the device.
- **Also:** group notes (one per member), your own note templates, a "Note check" for common audit gaps, a plain-language client handout, print or save as PDF, and a client-facing view for self-report screenings.

Live site: https://staviiramos.github.io/Progress-Note-Writer/

## Privacy

- Names and HIPAA Safe Harbor identifiers are removed **on the device, before anything is sent** to the AI model. There is an allowlist for words that should not be treated as names, and a "Names to always redact" field.
- Nothing is stored. Notes live in memory only; "Note completed" erases everything. The browser keeps only the API key, the allowlist, your signature line and your preferences (format, tone, templates and similar). No client information is saved.
- Generation uses [Groq](https://console.groq.com) with your own API key. Confirm your provider's Business Associate Agreement before entering identifiable information.

## Development

The whole app is the single file `index.html` (React 18 and Babel standalone from unpkg, no build step). Open it in a browser or serve the folder with `python3 -m http.server`.

```
npm install   # dev-only test tooling
npm test      # JSX compiles; redaction, scoring and note-helper checks pass
```

See `CLAUDE.md` for architecture and ground rules, and `HANDOFF.md` for current state.
