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

// 4. AI-buzzword scrub removes em dashes and banned words.
const scrubbed = L.scrubText('Writer will delve into goals — moreover, review plan.');
check('scrubText removes em dash and buzzwords', !/—|delve|moreover/i.test(scrubbed), `output: ${scrubbed}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
