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

// 4. AI-buzzword scrub removes em dashes and banned words.
const scrubbed = L.scrubText('Writer will delve into goals — moreover, review plan.');
check('scrubText removes em dash and buzzwords', !/—|delve|moreover/i.test(scrubbed), `output: ${scrubbed}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
