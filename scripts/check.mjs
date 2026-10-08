// Offline checks for index.html: JSX compiles, and on-device redaction works on placeholder samples.
// Usage: npm install && npm test            (or: node scripts/check.mjs path/to/file.html)
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const file = process.argv[2] || new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(file, 'utf8');
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '\n      ' + detail}`);
  if (!ok) failures++;
};

// 1. Every <script type="text/babel"> block compiles.
let Babel = null;
try { Babel = require('@babel/standalone'); } catch { console.log('SKIP  JSX compile (run `npm install` first)'); }
if (Babel) {
  [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    try { Babel.transform(m[1], { presets: ['react'] }); check(`babel block #${i} compiles`, true); }
    catch (e) { check(`babel block #${i} compiles`, false, e.message.split('\n')[0]); }
  });
}

// 1b. Screening item wording areas: right number of items, one item per line.
// Reports counts and line numbers only; never print the item text (see CLAUDE.md).
{
  const lines = html.split('\n');
  for (const [name, start, end, expected] of [
    ['ASRS-v1.1', 'ASRS-v1.1 ITEM WORDING: PASTE HERE', 'END ASRS-v1.1 ITEM WORDING', 18],
    ['C-SSRS', 'C-SSRS SCREEN ITEM WORDING: PASTE HERE', 'END C-SSRS SCREEN ITEM WORDING', 7],
  ]) {
    const s = lines.findIndex(l => l.includes(start)), e = lines.findIndex(l => l.includes(end));
    if (s < 0 || e < 0) { check(`${name} item wording area present`, false, 'marker comment missing'); continue; }
    const body = lines.slice(s + 1, e).map((l, i) => ({ t: l.trim(), n: s + 2 + i }))
      .filter(x => x.t && !x.t.startsWith('//') && !x.t.startsWith('const ') && x.t !== '];');
    const broken = body.filter(x => !/^'.*',$/.test(x.t)).map(x => x.n);
    check(`${name} item wording: ${expected} items, one per line`, body.length === expected && !broken.length,
      `found ${body.length} entries; lines not in 'text', form: ${broken.join(', ') || 'none'}`);
  }
}

// 2. Load window.PN_LIB (the plain <script> block) in a sandbox.
const libSrc = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.PN_LIB'));
const sandbox = { window: {} };
vm.runInNewContext(libSrc, sandbox);
const L = sandbox.window.PN_LIB;
check('window.PN_LIB loads', !!L && typeof L.redactPHI === 'function');

// 3. Redaction samples. Placeholder data only; never put realistic case details here.
const run = (text, allowlist = []) => {
  const names = L.detectNames(text, [], allowlist);
  return L.redactPHI(L.redactNames(text, names, 'Client'));
};
const cases = [
  { name: 'mid-sentence name is replaced with subject label',
    input: 'Session held with Alexa Sample today.', mustNot: ['Alexa', 'Sample'], must: ['Client'] },
  { name: 'phone, email, SSN redacted',
    input: 'Contact 555-010-0000 or test.user@example.com, SSN 000-12-3456.',
    mustNot: ['555-010-0000', 'test.user@example.com', '000-12-3456'], must: ['[PHONE-REDACTED]', '[EMAIL-REDACTED]', '[SSN-REDACTED]'] },
  { name: 'dates and ZIP redacted',
    input: 'Seen on 01/02/2000 and March 3, 2001 at ZIP 00000.', mustNot: ['01/02/2000', '00000'], must: ['[DATE-REDACTED]', '[ZIP-REDACTED]'] },
  { name: 'URL, IP and MRN redacted',
    input: 'See https://example.com/x from 10.0.0.1, MRN: 12345.', mustNot: ['example.com', '10.0.0.1', '12345'] },
  { name: 'age 90+ redacted',
    input: 'Client is 92 years old.', mustNot: ['92 years'], must: ['[AGE-REDACTED]'] },
  { name: 'clinical abbreviations are not treated as names',
    input: 'Writer used CBT and DBT skills; Client engaged.', must: ['CBT', 'DBT'] },
  { name: 'allowlisted word is kept',
    input: 'Discussed the Riverside group schedule.', allow: ['Riverside'], must: ['Riverside'] },
];
for (const c of cases) {
  const out = run(c.input, c.allow);
  const leaked = (c.mustNot || []).filter(s => out.includes(s));
  const missing = (c.must || []).filter(s => !out.includes(s));
  check(c.name, !leaked.length && !missing.length, `output: ${out}`);
}

// 3a. Names that open a sentence. Placeholder names only.
{
  const caught = [
    ['Jordan said the week went well.', 'Jordan'],
    ['Riley reported better sleep.', 'Riley'],
    ['Session went well. Morgan said it helped.', 'Morgan'],
    ['Met with Morgan today. Morgan was on time.', 'Morgan'],
    ["Casey's sister attended.", 'Casey'],
    ['Avery Placeholder arrived late.', 'Avery'],
    ['Discussed plans.\nQuinn shared an update.', 'Quinn'],
  ];
  for (const [text, name] of caught) {
    const out = run(text);
    check(`sentence-start name caught: "${text.split(/[ .']/)[0]}..."`, !out.includes(name) && out.includes('Client'), `output: ${out}`);
  }
  check('possessive keeps its \'s', run("Casey's sister attended.").startsWith("Client's"), run("Casey's sister attended."));
  const kept = [
    'Mood was stable this week.', 'Mother reported improvement.', 'Sleep has improved.', 'Today was productive.',
    'Overall the session was productive.', 'Writer reviewed coping skills.', 'Client said the week went well.',
    'Reviewed homework. Worked on breathing skills.', 'Feeling better was reported.', 'Homework was completed.',
    'Anxiety is lower. Attendance was consistent.',
  ];
  for (const text of kept) check(`ordinary sentence start kept: "${text.slice(0, 24)}"`, run(text) === text, `output: ${run(text)}`);

  // "Names to always redact": any letter case, full and partial names.
  const san = L.makeSanitizer(['jordan mentioned it. Met with JORDAN later. Placeholder came too.'], { subject: 'Client', allowlist: [], safeHarbor: false, alwaysRedact: 'Jordan Placeholder' });
  const o = san.clean('jordan mentioned it. Met with JORDAN later. Placeholder came too.');
  check('always-redact list matches any case and each part of a name', !/jordan|placeholder/i.test(o), `output: ${o}`);
  check('always-redact names are reported', san.names.includes('Jordan'), JSON.stringify(san.names));
}

// 3b. makeSanitizer: shared de-identification used by the Intake, Dx and Treatment Plan tabs.
{
  const fields = ['Stressors at work with Jordan Placeholder.', 'Reports conflict; call 555-010-0000 on 01/02/2000.', 'F33.1 — Major Depressive Disorder, recurrent, moderate'];
  const san = L.makeSanitizer(fields, { subject: 'Client', allowlist: [], safeHarbor: true });
  const out = fields.map(san.clean).join(' | ');
  const leaked = ['Jordan', 'Placeholder', '555-010-0000', '01/02/2000'].filter(s => out.includes(s));
  check('makeSanitizer redacts names and PHI across fields', !leaked.length && out.includes('[PHONE-REDACTED]'), `output: ${out}`);
  check('makeSanitizer keeps diagnosis wording', out.includes('Major Depressive Disorder'), `output: ${out}`);
  check('makeSanitizer reports what it redacted', san.names.includes('Jordan') && san.phi.length === 2, JSON.stringify({ names: san.names, phi: san.phi }));

  // A name found in one field is also redacted where it opens a sentence in another field.
  const san2 = L.makeSanitizer(['Met with Riley Example.', 'Riley set a goal.'], { subject: 'Patient', allowlist: [], safeHarbor: false });
  check('makeSanitizer applies names found in any field to all fields', san2.clean('Riley set a goal.') === 'Patient set a goal.', san2.clean('Riley set a goal.'));

  const san3 = L.makeSanitizer(['Seen 01/02/2000 near Riverside.'], { subject: 'Client', allowlist: ['Riverside'], safeHarbor: false });
  const out3 = san3.clean('Seen 01/02/2000 near Riverside.');
  check('makeSanitizer honors allowlist and Safe Harbor off', out3 === 'Seen 01/02/2000 near Riverside.', out3);
}

// 3c. The progress-note prompt must not echo the redacted names back to the model.
{
  const prompt = L.buildPrompt({ format: 'soap', tone: 'balanced', subject: 'Client', inputMode: 'free',
    freeText: 'Client discussed goals.', structured: {}, bullets: '', interventions: [], mse: {}, risk: {}, redactedNames: ['Jordan', 'Placeholder'],
    screeningScores: [], activeGoals: [] });
  check('buildPrompt does not list redacted names', !/Jordan|Placeholder/.test(prompt) && prompt.includes('replaced with "Client"'));
}

// 3c2. Safety plan lines reach the progress-note and intake prompts; the sanitizer cleans them first.
{
  const base = { format: 'soap', tone: 'balanced', subject: 'Client', inputMode: 'free', freeText: 'Client discussed goals.',
    structured: {}, bullets: '', interventions: [], mse: {}, risk: {}, redactedNames: [], screeningScores: [], activeGoals: [] };
  const lines = ['Warning signs: placeholder sign A', 'Reasons for living: placeholder reason B'];
  const p1 = L.buildPrompt({ ...base, safetyPlanLines: lines });
  check('buildPrompt includes safety plan lines', p1.includes('Safety plan completed or reviewed') && lines.every(l => p1.includes(l)));
  check('buildPrompt omits safety plan section when empty', !L.buildPrompt({ ...base, safetyPlanLines: [] }).includes('Safety plan completed'));
  const p2 = L.buildIntakePrompt({ subject: 'Client', screeningScores: [], safetyPlanLines: lines });
  check('buildIntakePrompt includes safety plan lines', lines.every(l => p2.includes(l)));
  // The app sanitizes each step's text on its own and adds the fixed label afterwards.
  const sp = ['Pacing and skipping meals', 'Call Morgan Placeholder at 555-010-0000'];
  const san = L.makeSanitizer(sp, { subject: 'Client', allowlist: [], safeHarbor: true });
  const out = sp.map(san.clean).join(' | ');
  check('safety plan text is de-identified', !/Morgan|Placeholder|555-010-0000/.test(out), `output: ${out}`);
  check('safety plan text keeps its first word', out.startsWith('Pacing and skipping meals'), `output: ${out}`);
}

// 3d. ASRS-v1.1 scoring: Part A thresholds (items 1-3 at >= 2, items 4-6 at >= 3), 4+ = positive, total 0-72.
{
  const fill = (partA, rest = 0) => Object.fromEntries([...partA, ...Array(12).fill(rest)].map((v, i) => [i, v]));
  const pos = L.scoreASRS(fill([2, 2, 2, 3, 0, 0]));
  check('ASRS Part A positive at 4 items in range', pos.partAComplete && pos.partAPositives === 4 && pos.partAPositive && pos.complete, JSON.stringify(pos));
  const neg = L.scoreASRS(fill([2, 2, 2, 2, 2, 2]));
  check('ASRS items 4-6 need Often (3) to count', neg.partAPositives === 3 && !neg.partAPositive, JSON.stringify(neg));
  const max = L.scoreASRS(fill([4, 4, 4, 4, 4, 4], 4));
  check('ASRS total out of 72', max.total === 72 && max.answered === 18, JSON.stringify(max));
  const partial = L.scoreASRS({ 0: 4, 1: 4 });
  check('ASRS partial answers are not complete', !partial.complete && !partial.partAComplete && partial.partAAnswered === 2, JSON.stringify(partial));
}

// 3e. C-SSRS screen scoring: skip logic and triage level. Answers are 1 (Yes) / 0 (No) by item index.
{
  const c = (a) => L.scoreCSSRS(a);
  const allNo = c({ 0: 0, 1: 0, 5: 0 });
  check('C-SSRS all No: complete with items 3-5 skipped', allNo.complete && allNo.required === 3 && allNo.level === 'none', JSON.stringify(allNo));
  check('C-SSRS item 1 only: low', c({ 0: 1, 1: 0, 5: 0 }).level === 'low');
  check('C-SSRS item 2 Yes requires items 3-5', !c({ 0: 1, 1: 1, 5: 0 }).complete && c({ 0: 1, 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 }).complete);
  check('C-SSRS item 3: moderate', c({ 0: 1, 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 }).level === 'moderate');
  check('C-SSRS item 4 or 5: high', c({ 0: 1, 1: 1, 2: 0, 3: 1, 4: 0, 5: 0 }).level === 'high' && c({ 0: 1, 1: 1, 2: 0, 3: 0, 4: 1, 5: 0 }).level === 'high');
  check('C-SSRS items 3-5 ignored when item 2 is No', c({ 0: 0, 1: 0, 3: 1, 4: 1, 5: 0 }).level === 'none');
  check('C-SSRS item 6 Yes requires follow-up', !c({ 0: 0, 1: 0, 5: 1 }).complete);
  check('C-SSRS item 6 not recent: moderate', c({ 0: 0, 1: 0, 5: 1, 6: 0 }).level === 'moderate');
  const recent = c({ 0: 0, 1: 0, 5: 1, 6: 1 });
  check('C-SSRS item 6 recent: high', recent.level === 'high' && recent.recentBehavior && recent.endorsed.join() === '6', JSON.stringify(recent));
}

// 3f. Note editing helpers: parse -> join round trip, plain text, revision prompts.
{
  const note = 'Subjective:\nClient described the week.\n\nObjective:\nClient was engaged.\n\nAssessment:\nProgress noted.\n\nPlan:\nContinue weekly sessions.';
  const secs = L.parseNote(note, 'soap');
  check('joinNote round-trips parseNote', JSON.stringify(L.parseNote(L.joinNote(secs), 'soap')) === JSON.stringify(secs));
  const plain = L.plainNote(secs);
  check('plainNote drops headings', !/Subjective|Objective|Assessment|Plan:/.test(plain) && plain.includes('Client was engaged.'), plain);
  const sp = L.buildRevisePrompt({ context: 'CTX', note, instruction: '', heading: 'Assessment' });
  check('section revise prompt targets one section', sp.startsWith('CTX') && sp.includes('Rewrite ONLY the "Assessment" section'));
  const wp = L.buildRevisePrompt({ context: 'CTX', note, instruction: 'Make it shorter' });
  check('whole-note revise prompt keeps headings', wp.includes('Revise the whole draft: Make it shorter') && wp.includes('Keep the same section headings'));
}

// 3g. Dx justification prompt cites screening results only when given.
{
  const base = { subject: 'Client', diagnosis: 'Placeholder diagnosis', selectedSymptoms: [{ label: 'Placeholder symptom', context: '' }], observations: '' };
  const withScores = L.buildDxPrompt({ ...base, screeningScores: ['PHQ-9: 12/27 (Moderate depression)'] });
  check('buildDxPrompt includes screening results', withScores.includes('Standardized screening results: PHQ-9: 12/27') && withScores.includes('supporting evidence'));
  check('buildDxPrompt omits screening section when empty', !L.buildDxPrompt({ ...base, screeningScores: [] }).includes('screening'));
}

// 3h. Billing code suggestions from service type and minutes.
{
  const c = (o) => L.suggestCPT(o).text;
  check('CPT: 15 min individual has no code', c({ service: 'individual', minutes: 15 }) === '');
  check('CPT: 16/37/38/52/53 min individual', [16, 37, 38, 52, 53].map(m => c({ service: 'individual', minutes: m })).join() === '90832,90832,90834,90834,90837');
  check('CPT: video adds -95, phone -93', c({ service: 'individual', minutes: 45, modality: 'video' }) === '90834-95' && c({ service: 'individual', minutes: 45, modality: 'phone' }) === '90834-93');
  check('CPT: interactive complexity add-on', c({ service: 'individual', minutes: 55, interactiveComplexity: true }) === '90837, +90785');
  check('CPT: no 90785 with crisis', !c({ service: 'crisis', minutes: 60, interactiveComplexity: true }).includes('90785'));
  check('CPT: crisis 74 / 75 / 105 min', [74, 75, 105].map(m => c({ service: 'crisis', minutes: m })).join('|') === '90839|90839, 90840|90839, 90840 x2');
  check('CPT: crisis under 30 min falls back', c({ service: 'crisis', minutes: 25 }) === '90832');
  check('CPT: family needs 26 min', c({ service: 'familyWith', minutes: 25 }) === '' && c({ service: 'familyWithout', minutes: 26 }) === '90846');
  check('CPT: group and intake need no minutes', c({ service: 'group' }) === '90853' && c({ service: 'intake', modality: 'video' }) === '90791-95');
}

// 3i. Dates never reach the prompt; placeholders are filled in on-device.
{
  const map = { '[TARGET-DATE-1]': '12/31/2000' };
  const filled = L.fillTokens('Goal due [TARGET-DATE-1].', map);
  check('fillTokens fills placeholders', filled === 'Goal due 12/31/2000.', filled);
  check('unfillTokens restores placeholders', L.unfillTokens(filled, map) === 'Goal due [TARGET-DATE-1].');
  const prompt = L.buildPrompt({ format: 'soap', tone: 'balanced', subject: 'Client', conciseness: 'standard', inputMode: 'free', freeText: 'Client described the week.',
    interventions: [], mse: {}, risk: {}, sessionDuration: 53, service: 'individual', modality: 'video', telehealth: { consent: true, locationVerified: true, state: 'CA', atHome: true },
    diagnoses: ['Primary: F41.1 — Generalized Anxiety Disorder'], activeGoals: [{ text: 'Placeholder goal', targetToken: '[TARGET-DATE-1]', progress: 'Progressing' }] });
  check('progress prompt has no calendar date or state', !/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\bCA\b/.test(prompt));
  check('progress prompt carries diagnosis, goal progress, telehealth', prompt.includes('Diagnoses: Primary: F41.1') && prompt.includes('Progress this session: Progressing') && prompt.includes('consent to telehealth was confirmed'));
  check('untouched risk is stated as not assessed', prompt.includes('Risk: not assessed this session'));
  const header = L.buildServiceHeader({ date: '2000-01-02', start: '9:00 AM', end: '9:53 AM', minutes: 53, service: 'individual', modality: 'video',
    telehealth: { consent: true, locationVerified: true, state: 'CA', atHome: true }, cpt: L.suggestCPT({ service: 'individual', minutes: 53, modality: 'video' }) });
  check('service header has date, code and POS', header[0] === 'Date of service: 01/02/2000' && header.some(l => l.includes('90837-95 · POS 10')), header.join(' | '));
  const plan = L.buildPlanPrompt({ subject: 'Client', goals: [{ text: 'Placeholder goal', objectives: 'Step one\nStep two', interventions: ['CBT'], targetToken: '[TARGET-DATE-1]' }], reviewToken: '[REVIEW-DATE]', participated: true });
  check('plan prompt uses placeholders and objectives', plan.includes('[TARGET-DATE-1]') && plan.includes('[REVIEW-DATE]') && plan.includes('- Step two') && !/\d{4}-\d{2}-\d{2}/.test(plan));
}

// 3j. Risk details, note types and intake sections.
{
  const risk = { si: { status: 'endorsed', note: '' }, hi: { status: 'denied', note: '' } };
  const p = L.buildPrompt({ format: 'soap', tone: 'balanced', subject: 'Client', conciseness: 'standard', inputMode: 'free', freeText: 'Placeholder session.', interventions: [], mse: {},
    risk, riskExtra: { level: 'Low', protective: 'supportive family', means: 'Denied', meansNote: '', siDetails: ['Passive ideation only'] } });
  check('risk prompt lists SI details, means, protective factors, level', p.includes('passive ideation only reported') && p.includes('Access to lethal means: Denied') && p.includes('Protective factors: supportive family') && p.includes("overall risk level: Low"));
  const col = L.buildPrompt({ noteType: 'collateral', format: 'soap', tone: 'balanced', subject: 'Client', conciseness: 'standard', inputMode: 'free', freeText: 'Placeholder call.', interventions: [], mse: {}, risk: {}, collateral: { with: 'School staff', method: 'Phone', roi: true } });
  check('collateral prompt: no risk section, release on file', !col.includes('Risk') && col.includes('release of information is on file') && col.includes('collateral contact note'));
  const dc = L.buildPrompt({ noteType: 'discharge', format: 'soap', tone: 'balanced', subject: 'Client', conciseness: 'standard', inputMode: 'free', freeText: 'Placeholder summary.', interventions: [], mse: {}, risk: {}, discharge: { reason: 'Treatment goals met', aftercare: '' }, closedGoals: [{ status: 'achieved', text: 'Placeholder goal' }] });
  check('discharge prompt uses discharge headings and goal status', dc.includes('Reason for Discharge:') && dc.includes('Met: Placeholder goal'));
  check('cancellation note is written on-device', L.buildCancellationNote({ subject: 'Client', kind: 'noShow', reason: 'No reason given', outreach: 'voicemail', next: 'pending' })
    === 'Client did not attend the scheduled session and did not contact Writer beforehand. No reason was given. Writer called Client and left a voicemail requesting a call back. Rescheduling is pending.');
  const intake = L.buildIntakePrompt({ subject: 'Client', chiefComplaint: 'Placeholder concern', psychosocial: { family: 'lives with a roommate' }, strengths: 'motivated', consentReviewed: true, safety: { means: 'Denied' } });
  check('intake prompt has psychosocial, strengths, consent and means', intake.includes('Psychosocial History:') && intake.includes('Family and living situation: lives with a roommate') && intake.includes('Strengths and protective factors: motivated') && intake.includes('limits of confidentiality') && intake.includes('Access to lethal means: Denied'));
}

// 3k. No diagnosis code that ICD-10-CM treats as a non-billable header (checked against the FY2027 set).
{
  const headers = ['F50.0', 'F50.01', 'F50.02', 'F50.2', 'F50.8', 'F50.81', 'F50.89', 'G47.0'];
  const bad = L.DX_DATABASE.filter(d => headers.includes(d.code)).map(d => d.code);
  check('DX_DATABASE has no non-billable header codes', !bad.length, bad.join(', '));
  const codes = L.DX_DATABASE.map(d => d.code);
  check('DX_DATABASE codes are unique', new Set(codes).size === codes.length);
}

// 4. AI-buzzword scrub removes em dashes and banned words.
const scrubbed = L.scrubText('Writer will delve into goals — moreover, review plan.');
check('scrubText removes em dash and buzzwords', !/—|delve|moreover/i.test(scrubbed), `output: ${scrubbed}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
