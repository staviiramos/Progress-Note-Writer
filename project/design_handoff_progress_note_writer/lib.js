// lib.js — utilities for Progress Note Writer
// Loaded as a plain script BEFORE babel transpiles app.jsx.

window.PN_LIB = (() => {
  // ────────────── Formats ──────────────
  const FORMATS = {
    soap: {
      name: 'SOAP',
      full: 'SOAP (Subjective, Objective, Assessment, Plan)',
      sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
      description:
        'Subjective: what the {subj} reports. ' +
        'Objective: Writer\'s observations, behavior, mental status. ' +
        'Assessment: clinical formulation, response to interventions, progress toward goals. ' +
        'Plan: next session focus, homework, referrals, frequency.',
    },
    dap: {
      name: 'DAP',
      full: 'DAP (Data, Assessment, Plan)',
      sections: ['Data', 'Assessment', 'Plan'],
      description:
        'Data: factual content from session, what was discussed, observable behavior. ' +
        'Assessment: clinical formulation and progress toward goals. ' +
        'Plan: next steps, homework, referrals.',
    },
    birp: {
      name: 'BIRP',
      full: 'BIRP (Behavior, Intervention, Response, Plan)',
      sections: ['Behavior', 'Intervention', 'Response', 'Plan'],
      description:
        'Behavior: what the {subj} presented with and how they engaged. ' +
        'Intervention: what the Writer did during session. ' +
        'Response: how the {subj} responded to interventions. ' +
        'Plan: next session focus and homework.',
    },
    girp: {
      name: 'GIRP',
      full: 'GIRP (Goal, Intervention, Response, Plan)',
      sections: ['Goal', 'Intervention', 'Response', 'Plan'],
      description:
        'Goal: the treatment goal addressed this session. ' +
        'Intervention: what the Writer did. ' +
        'Response: how the {subj} responded. ' +
        'Plan: next steps.',
    },
    pirp: {
      name: 'PIRP',
      full: 'PIRP (Problem, Intervention, Response, Plan)',
      sections: ['Problem', 'Intervention', 'Response', 'Plan'],
      description:
        'Problem: presenting problem or symptom addressed. ' +
        'Intervention: clinical actions taken. ' +
        'Response: {subj}\'s response. ' +
        'Plan: next steps.',
    },
    emr: {
      name: 'EMR Paragraph',
      full: 'EMR One-Paragraph Note',
      sections: [],
      description:
        'A single concise paragraph integrating presentation, interventions, response, and plan. ' +
        'No headings; flowing clinical prose; 4 to 8 sentences.',
    },
    narrative: {
      name: 'Narrative',
      full: 'Narrative / Free-form',
      sections: [],
      description:
        'A free-form clinical narrative with natural paragraph breaks. ' +
        'Focus on therapeutic process and clinical reasoning without rigid headings.',
    },
  };

  // ────────────── Tone presets ──────────────
  const TONES = {
    conversational: {
      label: 'Conversational',
      desc: 'Approachable, plain-language; minimal jargon',
      guidance:
        'Write in a warm, plain-spoken professional voice. Avoid heavy clinical jargon. ' +
        'Use everyday words where possible while keeping clinical accuracy.',
    },
    balanced: {
      label: 'Balanced',
      desc: 'Standard clinical documentation tone',
      guidance:
        'Write in standard clinical documentation tone: professional, concise, and observational. ' +
        'Use clinical terminology where it adds precision but do not over-formalize.',
    },
    clinical: {
      label: 'Highly Clinical',
      desc: 'Formal, terminology-forward, billing-ready',
      guidance:
        'Write in a highly clinical, formal register suitable for medical records and billing review. ' +
        'Use precise clinical terminology, formal syntax, and third-person observational phrasing throughout.',
    },
  };

  // ────────────── Intervention library ──────────────
  const INTERVENTIONS = [
    'CBT', 'DBT', 'ACT', 'Motivational Interviewing', 'Psychodynamic',
    'Behavioral Activation', 'Cognitive Restructuring', 'Exposure',
    'Mindfulness', 'Solution-Focused', 'Narrative Therapy',
    'IFS (Parts Work)', 'EMDR Prep', 'Psychoeducation',
    'Reflective Listening', 'Validation', 'Reframing', 'Grounding',
    'Skills Training', 'Relapse Prevention', 'Crisis Planning',
    'Family Systems', 'Trauma-Focused CBT',
  ];

  // ────────────── MSE options ──────────────
  const MSE_FIELDS = [
    { key: 'appearance', label: 'Appearance', options: ['', 'Well-groomed', 'Casually dressed', 'Disheveled', 'Appropriate to setting'] },
    { key: 'behavior', label: 'Behavior', options: ['', 'Cooperative', 'Engaged', 'Guarded', 'Restless', 'Withdrawn'] },
    { key: 'speech', label: 'Speech', options: ['', 'Normal rate/rhythm', 'Slow', 'Pressured', 'Soft', 'Tangential'] },
    { key: 'mood', label: 'Mood', options: ['', 'Euthymic', 'Anxious', 'Depressed', 'Irritable', 'Labile', 'Dysphoric'] },
    { key: 'affect', label: 'Affect', options: ['', 'Congruent', 'Constricted', 'Blunted', 'Flat', 'Expansive', 'Tearful'] },
    { key: 'thoughtProcess', label: 'Thought Process', options: ['', 'Linear/Logical', 'Tangential', 'Circumstantial', 'Flight of ideas', 'Disorganized'] },
    { key: 'thoughtContent', label: 'Thought Content', options: ['', 'WNL', 'Ruminative', 'Preoccupied', 'Hopeless', 'Paranoid'] },
    { key: 'insight', label: 'Insight', options: ['', 'Good', 'Fair', 'Limited', 'Poor'] },
    { key: 'judgment', label: 'Judgment', options: ['', 'Good', 'Fair', 'Limited', 'Poor'] },
    { key: 'orientation', label: 'Orientation', options: ['', 'A&O x4', 'A&O x3', 'A&O x2'] },
  ];

  const RISK_ITEMS = [
    { key: 'si', label: 'Suicidal Ideation' },
    { key: 'hi', label: 'Homicidal Ideation' },
    { key: 'selfHarm', label: 'Self-Harm' },
    { key: 'substance', label: 'Substance Use' },
    { key: 'aggression', label: 'Aggression' },
  ];

  // ────────────── HIPAA Safe Harbor PHI detection ──────────────
  // Detect the 18 HIPAA Safe Harbor identifiers (or the ones that are reliably
  // pattern-matchable: phones, emails, SSNs, URLs, IPs, ZIP/postal, specific
  // dates, MRN-style codes, ages >= 90). Names are handled by detectNames.
  // Each returned entry is { kind, value } so the UI can group flags by type.
  const PHI_PATTERNS = [
    { kind: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
    { kind: 'Phone', re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
    { kind: 'Email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { kind: 'URL', re: /\bhttps?:\/\/[^\s)]+/g },
    { kind: 'IP', re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
    { kind: 'Date', re: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g },
    { kind: 'Date', re: /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{2,4})?\b/gi },
    { kind: 'ZIP', re: /\b\d{5}(?:-\d{4})?\b/g },
    { kind: 'MRN', re: /\b(?:MRN|Record\s*#|Acct\s*#|Chart\s*#)\s*[:#]?\s*\w+/gi },
    { kind: 'Age 90+', re: /\b(?:age\s+)?(?:9\d|1[0-1]\d)\s*(?:-|to)?\s*(?:years?[- ]old|y\/o|yo)\b/gi },
  ];

  function detectPHI(text) {
    if (!text) return [];
    const found = [];
    const seen = new Set();
    PHI_PATTERNS.forEach(({ kind, re }) => {
      const matches = text.match(re) || [];
      matches.forEach((m) => {
        const key = kind + '::' + m.toLowerCase();
        if (!seen.has(key)) { seen.add(key); found.push({ kind, value: m }); }
      });
    });
    return found;
  }

  function redactPHI(text, subjectLabel) {
    if (!text) return text;
    let out = text;
    PHI_PATTERNS.forEach(({ kind, re }) => {
      const token = `[${kind === 'Age 90+' ? 'AGE' : kind.toUpperCase()}-REDACTED]`;
      out = out.replace(re, token);
    });
    return out;
  }

  // ────────────── De-identification (names only) ──────────────
  // Pragmatic name detection: capitalized words mid-sentence + explicit list.
  // We do not try to be perfect — we flag candidates and tell the model to use
  // [Client]/[Patient] in place of any proper name.
  const COMMON_WORDS = new Set([
    'I','You','He','She','We','They','It','My','Your','His','Her','Our','Their','Its',
    'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
    'January','February','March','April','May','June','July','August','September','October','November','December',
    'God','Jesus','Christ','Lord','Buddha','Allah',
    'CBT','DBT','ACT','EMDR','IFS','MSE','WNL',
    'PhD','MD','LCSW','LPC','LMFT','PsyD',
    'Client','Patient','Writer','Therapist',
  ]);

  function detectNames(text, extraNames) {
    if (!text) return [];
    const found = new Set();
    // explicit list always flagged
    (extraNames || []).forEach((n) => { if (n && n.trim()) found.add(n.trim()); });
    // detect mid-sentence Capitalized tokens (skip sentence starts)
    const sentences = text.split(/([.!?]\s+)/);
    sentences.forEach((seg, idx) => {
      // even indices are sentence bodies
      if (idx % 2 !== 0) return;
      const words = seg.split(/\s+/);
      words.forEach((w, wIdx) => {
        const clean = w.replace(/[^A-Za-z'\-]/g, '');
        if (!clean || clean.length < 2) return;
        if (!/^[A-Z][a-z'\-]+$/.test(clean)) return;
        if (COMMON_WORDS.has(clean)) return;
        // skip if it's the first word of the sentence segment
        if (wIdx === 0) return;
        found.add(clean);
      });
    });
    return Array.from(found);
  }

  function redactNames(text, names, subjectLabel) {
    if (!text || !names || !names.length) return text;
    let out = text;
    // sort by length desc so "Mary Jane" replaces before "Mary"
    const sorted = [...names].sort((a, b) => b.length - a.length);
    sorted.forEach((n) => {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\b' + escaped + '\\b', 'g');
      out = out.replace(re, subjectLabel);
    });
    return out;
  }

  // ────────────── Output scrubber ──────────────
  // Removes em-dashes and AI buzzwords from generated text.
  // Em-dash strategy: if it's a parenthetical (space–space), replace with comma.
  // If it's appending a clause without spaces, replace with colon or period.
  const AI_BUZZWORDS = [
    // verb usages (and forms) that read as AI cliches
    /\bdelv(e|ed|es|ing)\b/gi,
    /\bnavigat(e|ed|es|ing)\b/gi,
    /\btapestry\b/gi,
    /\bunderscore(s|d)?\b/gi,
    // common AI hedges and filler
    /\bit\s+is\s+important\s+to\s+note\s+that\b/gi,
    /\bit['']s\s+important\s+to\s+note\s+that\b/gi,
    /\bin\s+today['']s\s+(fast[- ]paced\s+)?world\b/gi,
    /\bmoreover,?\s*/gi,
    /\bfurthermore,?\s*/gi,
    /\bin\s+conclusion,?\s*/gi,
    /\bas\s+an?\s+(AI|language\s+model)\b/gi,
    /\bdive\s+(into|deep\s+into)\b/gi,
    /\brealm\s+of\b/gi,
    /\blandscape\s+of\b/gi,
    /\bplethora\s+of\b/gi,
    /\bmyriad\s+of\b/gi,
    /\bharness(es|ed|ing)?\b/gi,
    /\bleverag(e|ed|es|ing)\b/gi,
    /\bunpack(ed|ing|s)?\b/gi,
    /\bmeticulous(ly)?\b/gi,
    /\bnuanced?\b/gi,
    /\bholistic(ally)?\b/gi,
  ];
  // Replacements per pattern — keyed by the regex source string. Default: drop.
  const BUZZWORD_REPLACE = {
    'delv(e|ed|es|ing)': (m) => m.toLowerCase().startsWith('delv') ? 'explor' + m.slice(4) : m,
    'navigat(e|ed|es|ing)': (m) => 'manag' + m.slice(7),
    'tapestry': 'range',
    'underscore(s|d)?': 'emphasiz',
    'dive (into|deep into)': 'explore',
    'realm of': 'area of',
    'landscape of': 'area of',
    'plethora of': 'many',
    'myriad of': 'many',
    'harness(es|ed|ing)?': 'use',
    'leverag(e|ed|es|ing)': 'use',
    'unpack(ed|ing|s)?': 'examine',
    'meticulous(ly)?': '',
    'nuanced?': '',
    'holistic(ally)?': 'comprehensive',
  };

  function scrubText(text) {
    if (!text) return text;
    let out = text;

    // 1. Em-dashes: " — " → ", "  and "—" → ", "
    out = out.replace(/\s*—\s*/g, ', ');
    // en-dashes only between numbers stay (date ranges); elsewhere → comma
    out = out.replace(/(\D)\s*–\s*(\D)/g, '$1, $2');

    // 2. Curly quotes → straight
    out = out.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

    // 3. AI buzzword passes
    AI_BUZZWORDS.forEach((re) => {
      const srcKey = re.source.replace(/^\\b|\\b$/g, '');
      const replacement = BUZZWORD_REPLACE[srcKey];
      if (replacement === undefined) {
        // generic — drop the word entirely
        out = out.replace(re, '');
      } else if (typeof replacement === 'function') {
        out = out.replace(re, replacement);
      } else {
        out = out.replace(re, replacement);
      }
    });

    // 4. Cleanup: double spaces, space-before-punct, doubled commas
    out = out.replace(/[ \t]+/g, ' ');
    out = out.replace(/\s+([.,;:!?])/g, '$1');
    out = out.replace(/,\s*,/g, ',');
    out = out.replace(/\.\s*\./g, '.');
    out = out.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    // trim trailing space on each line
    out = out.split('\n').map((l) => l.trimEnd()).join('\n');
    // collapse 3+ blank lines
    out = out.replace(/\n{3,}/g, '\n\n');

    return out.trim();
  }

  // ────────────── Prompt builder ──────────────
  function buildPrompt({
    format, tone, subject, voiceMode, voiceStrength, voiceSample,
    inputMode, freeText, structured, bullets,
    interventions, mse, risk, redactedNames,
  }) {
    const fmt = FORMATS[format];
    const toneInfo = TONES[tone];
    const subj = subject; // "Client" or "Patient"
    const desc = fmt.description.replace(/\{subj\}/g, subj.toLowerCase());

    const parts = [];
    parts.push(
      `You are an experienced licensed psychotherapist documenting a session. ` +
      `Generate a DE-IDENTIFIED progress note in the ${fmt.full} format.`
    );
    parts.push('');
    parts.push('STRICT RULES:');
    parts.push(`- Refer to the therapist as "Writer" (never therapist, clinician, I, or a name).`);
    parts.push(`- Refer to the person being treated as "${subj}" (never by name, never with pronouns identifying gender unless the input is explicit).`);
    parts.push(`- Use no proper names of any kind. Replace any name in the input with "${subj}" or omit it.`);
    parts.push(`- Treat all input as already de-identified under HIPAA Safe Harbor (§164.514(b)). Tokens like [SSN-REDACTED], [PHONE-REDACTED], [DATE-REDACTED], [ZIP-REDACTED], [MRN-REDACTED], [URL-REDACTED], [IP-REDACTED], or [AGE-REDACTED] in the input MUST be preserved verbatim in the note. Do not guess at, reconstruct, or paraphrase the redacted value.`);
    parts.push(`- Do not invent clinical details not present in the input. If a section has no content, write "None reported." or omit the line.`);
    parts.push(`- Do not use em-dashes (—) or en-dashes (–). Use commas, periods, or colons instead.`);
    parts.push(`- Do not use these words or their forms: delve, navigate (use 'manage' or 'address'), tapestry, underscore (use 'emphasize'). Avoid generic AI phrasing.`);
    parts.push(`- Do not say "It is important to note that", "Moreover", "Furthermore", "In conclusion", or similar AI filler.`);
    parts.push(`- Output the note only. No preamble, no commentary, no closing line.`);
    parts.push('');
    parts.push(`FORMAT DETAIL: ${desc}`);
    if (fmt.sections.length > 0) {
      parts.push(`SECTION HEADINGS (use exactly these, each on its own line, followed by a colon):`);
      fmt.sections.forEach((s) => parts.push(`  ${s}:`));
    }
    parts.push('');
    parts.push(`TONE: ${toneInfo.label}. ${toneInfo.guidance}`);

    if (voiceMode && voiceSample && voiceSample.trim()) {
      parts.push('');
      parts.push(`VOICE PRESERVATION: ${voiceStrength}% — match the cadence, sentence length, and word choice in the sample below. The higher the percent, the more closely you mirror the writer's phrasing.`);
      parts.push('--- WRITER VOICE SAMPLE ---');
      parts.push(voiceSample.trim());
      parts.push('--- END SAMPLE ---');
    }

    parts.push('');
    parts.push('SESSION CONTENT:');

    if (inputMode === 'free' && freeText && freeText.trim()) {
      parts.push(freeText.trim());
    } else if (inputMode === 'structured') {
      const fields = [
        ['Presenting Issue / Focus', structured.presenting],
        ['Content Discussed', structured.content],
        ['Interventions Used (in session)', structured.interventionsText],
        ['Client/Patient Response', structured.response],
        ['Plan / Next Steps', structured.plan],
      ];
      fields.forEach(([k, v]) => {
        if (v && v.trim()) parts.push(`${k}: ${v.trim()}`);
      });
    } else if (inputMode === 'bullets' && bullets && bullets.trim()) {
      parts.push('Shorthand notes from session (expand these into full clinical prose):');
      parts.push(bullets.trim());
    }

    // interventions
    const intList = interventions.filter(Boolean);
    if (intList.length) {
      parts.push('');
      parts.push(`INTERVENTIONS APPLIED: ${intList.join(', ')}.`);
    }

    // MSE
    const mseEntries = Object.entries(mse || {}).filter(([_, v]) => v && v.trim());
    if (mseEntries.length) {
      parts.push('');
      parts.push('MENTAL STATUS EXAM:');
      mseEntries.forEach(([k, v]) => {
        const f = MSE_FIELDS.find((x) => x.key === k);
        if (f) parts.push(`  ${f.label}: ${v}`);
      });
    }

    // Risk — only include items the Writer actually touched (endorsed/active,
    // or denied with a note). If nothing was touched, omit the section entirely
    // so the generated note doesn't fabricate a risk paragraph.
    const touchedRisk = RISK_ITEMS
      .map(({ key, label }) => ({ label, ...(risk || {})[key] }))
      .filter((r) => r && (r.status || (r.note && r.note.trim())));
    if (touchedRisk.length) {
      parts.push('');
      parts.push('RISK ASSESSMENT (include only these items in the note):');
      touchedRisk.forEach((r) => {
        const note = r.note ? ` (${r.note.trim()})` : '';
        parts.push(`  ${r.label}: ${r.status || 'endorsed'}${note}`);
      });
    } else {
      parts.push('');
      parts.push('RISK ASSESSMENT: not addressed in side panel — do not include a risk section or risk statements in the note.');
    }

    if (redactedNames && redactedNames.length) {
      parts.push('');
      parts.push(`NOTE: The following names were redacted from input and replaced with "${subj}": ${redactedNames.join(', ')}. Do not reintroduce them.`);
    }

    parts.push('');
    parts.push('Generate the progress note now.');

    return parts.join('\n');
  }

  // ────────────── Parse generated note into sections ──────────────
  function parseNote(text, format) {
    const fmt = FORMATS[format];
    if (!fmt.sections.length) {
      // single block
      return [{ heading: null, body: text.trim() }];
    }
    const sections = [];
    const headings = fmt.sections;
    // build regex matching any heading at line start
    const re = new RegExp(
      '^(' + headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\s*:',
      'im'
    );
    let remaining = text.trim();
    let currentHeading = null;
    let current = '';
    const lines = remaining.split('\n');
    lines.forEach((line) => {
      const m = line.match(re);
      if (m) {
        if (currentHeading !== null || current.trim()) {
          sections.push({ heading: currentHeading, body: current.trim() });
        }
        currentHeading = m[1];
        current = line.slice(m[0].length).trim();
        if (current) current += '\n';
      } else {
        current += line + '\n';
      }
    });
    if (currentHeading !== null || current.trim()) {
      sections.push({ heading: currentHeading, body: current.trim() });
    }
    // filter empties
    return sections.filter((s) => s.heading || s.body);
  }

  return {
    FORMATS, TONES, INTERVENTIONS, MSE_FIELDS, RISK_ITEMS,
    detectNames, redactNames, detectPHI, redactPHI, scrubText, buildPrompt, parseNote,
  };
})();
