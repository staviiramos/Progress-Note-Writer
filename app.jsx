// app.jsx — Progress Note Writer

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const L = window.PN_LIB;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "warm",
  "density": "regular",
  "toneStyle": "segmented"
}/*EDITMODE-END*/;

// ─────────────────────── Icons ───────────────────────
const Icon = {
  copy: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  ),
  spark: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  ),
  check: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  shield: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  page: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  key: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5l2 2" />
    </svg>
  ),
  sliders: () => (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="var(--paper)" /><circle cx="15" cy="12" r="2" fill="var(--paper)" /><circle cx="9" cy="18" r="2" fill="var(--paper)" />
    </svg>
  ),
};

// ─────────────────────── Anthropic API call ───────────────────────
async function callAnthropicAPI(prompt, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    if (resp.status === 401) throw new Error('invalid_key');
    if (resp.status === 429) throw new Error('Rate limit reached. Wait a moment and try again.');
    throw new Error(err.error?.message || `API error (${resp.status})`);
  }

  const data = await resp.json();
  return data.content[0].text;
}

// ─────────────────────── Toast ───────────────────────
function useToast() {
  const [msg, setMsg] = useState(null);
  const tRef = useRef(null);
  const show = useCallback((m) => {
    setMsg(m);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [node, show];
}

// ─────────────────────── Tone scales ───────────────────────
function ToneSegmented({ value, onChange }) {
  const items = [['conversational', 'Conversational'], ['balanced', 'Balanced'], ['clinical', 'Highly Clinical']];
  return (
    <div className="seg tone-3" role="radiogroup">
      {items.map(([v, l]) => (
        <button key={v} type="button" role="radio"
                aria-pressed={value === v}
                onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function ToneDial({ value, onChange }) {
  const order = ['conversational', 'balanced', 'clinical'];
  const idx = Math.max(0, order.indexOf(value));
  const trackRef = useRef(null);
  const pick = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(order[Math.round(pct * 2)]);
  };
  const onDown = (e) => {
    pick(e.clientX);
    const mv = (ev) => pick(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="tone-dial" onPointerDown={onDown}>
      <div className="track" ref={trackRef}>
        <div className="knob" style={{ left: `${(idx / 2) * 100}%` }} />
      </div>
      <div className="labels">
        <span>Conversational</span><span>Balanced</span><span>Highly Clinical</span>
      </div>
    </div>
  );
}

function ToneStacked({ value, onChange }) {
  return (
    <div className="tone-stacked">
      {Object.entries(L.TONES).map(([k, t]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          <span><strong style={{ fontWeight: 500 }}>{t.label}</strong></span>
          <span className="desc">{t.desc}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────── API Key Modal ───────────────────────
function ApiKeyModal({ currentKey, onSave, onCancel }) {
  const [draft, setDraft] = useState(currentKey || '');
  const inputRef = useRef(null);

  useEffect(() => {
    // Small delay so the modal animation settles before focusing
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const save = () => {
    const k = draft.trim();
    if (!k) return;
    onSave(k);
  };

  const onKey = (e) => { if (e.key === 'Enter') save(); };

  return (
    <div className="modal-backdrop" onClick={onCancel || undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Anthropic API key</h3>
        <p>
          Your key is sent directly from this browser to <strong style={{ color: 'inherit' }}>api.anthropic.com</strong>. It is held in your session only — never written to disk and never shared with any other service.
        </p>
        <div className="row">
          <label className="field-label">API key</label>
          <input
            ref={inputRef}
            className="input"
            type="password"
            placeholder="sk-ant-api03-…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="api-key-note" style={{ marginBottom: 20 }}>
          Get your key at <strong>console.anthropic.com</strong>. Before using this tool with identifiable patient information, confirm your account has a HIPAA Business Associate Agreement with Anthropic. The key clears automatically when you close this browser tab.
        </p>
        <div className="modal-actions">
          {onCancel && (
            <button className="btn" onClick={onCancel}>Cancel</button>
          )}
          <button className="btn primary" disabled={!draft.trim()} onClick={save}>
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Main App ───────────────────────
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const html = document.documentElement;
    html.className = html.className
      .replace(/\btheme-\S+/g, '')
      .replace(/\bdensity-\S+/g, '')
      .trim();
    html.classList.add(`theme-${tweaks.theme}`);
    html.classList.add(`density-${tweaks.density}`);
  }, [tweaks.theme, tweaks.density]);

  // ─── API key (sessionStorage — clears on tab close) ───
  const [apiKey, setApiKey] = useState(() => {
    try { return sessionStorage.getItem('pn.apikey') || ''; } catch { return ''; }
  });
  const [showKeyModal, setShowKeyModal] = useState(false);

  const saveApiKey = (key) => {
    setApiKey(key);
    try { sessionStorage.setItem('pn.apikey', key); } catch {}
    setShowKeyModal(false);
  };

  // ─── Session state ───
  const [format, setFormat] = useState('soap');
  const [subject, setSubject] = useState('Client');
  const [tone, setTone] = useState('balanced');

  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceStrength, setVoiceStrength] = useState(50);
  const [voiceSample, setVoiceSample] = useState('');

  const [inputMode, setInputMode] = useState('free');
  const [freeText, setFreeText] = useState('');
  const [structured, setStructured] = useState({
    presenting: '', content: '', interventionsText: '', response: '', plan: '',
  });
  const [bullets, setBullets] = useState('');

  const [interventions, setInterventions] = useState([]);
  const [otherIntervention, setOtherIntervention] = useState('');
  const [mse, setMse] = useState({});
  const [risk, setRisk] = useState(
    L.RISK_ITEMS.reduce((acc, r) => { acc[r.key] = { status: null, note: '' }; return acc; }, {})
  );

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameFlags, setNameFlags] = useState([]);
  const [phiFlags, setPhiFlags] = useState([]);
  const [generatedMeta, setGeneratedMeta] = useState(null);
  const [safeHarbor, setSafeHarbor] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Wipe any legacy localStorage on mount
  useEffect(() => {
    try { localStorage.removeItem('pn.drafts'); } catch {}
  }, []);

  const [toast, showToast] = useToast();

  const rawInput = useMemo(() => {
    if (inputMode === 'free') return freeText;
    if (inputMode === 'bullets') return bullets;
    return Object.values(structured).join(' \n');
  }, [inputMode, freeText, bullets, structured]);

  const detectedNames = useMemo(() => L.detectNames(rawInput, []), [rawInput]);
  const detectedPHI = useMemo(() => safeHarbor ? L.detectPHI(rawInput) : [], [rawInput, safeHarbor]);

  // ─── Generate ───
  const generate = async () => {
    if (loading) return;
    if (!rawInput.trim()) { showToast('Add some session content first'); return; }
    if (!apiKey) { setShowKeyModal(true); return; }

    setLoading(true);
    setNameFlags(detectedNames);
    setPhiFlags(detectedPHI);

    const allNames = detectedNames;
    const sanitize = (s) => {
      let out = L.redactNames(s, allNames, subject);
      if (safeHarbor) out = L.redactPHI(out, subject);
      return out;
    };

    const prompt = L.buildPrompt({
      format, tone, subject,
      voiceMode: voiceOn,
      voiceStrength,
      voiceSample,
      inputMode,
      freeText: sanitize(freeText),
      structured: Object.fromEntries(Object.entries(structured).map(([k, v]) => [k, sanitize(v)])),
      bullets: sanitize(bullets),
      interventions: [
        ...interventions,
        ...otherIntervention.split(',').map((s) => s.trim()).filter(Boolean),
      ],
      mse,
      risk,
      redactedNames: allNames,
    });

    try {
      const raw = await callAnthropicAPI(prompt, apiKey);
      const cleaned = L.scrubText(raw);
      setNote(L.redactNames(cleaned, allNames, subject));
      setGeneratedMeta({ format, subject, tone, at: new Date() });
    } catch (err) {
      if (err.message === 'invalid_key') {
        setApiKey('');
        try { sessionStorage.removeItem('pn.apikey'); } catch {}
        showToast('Invalid API key — please check your key');
        setShowKeyModal(true);
      } else {
        showToast(err.message || 'Generation failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Copy / Wipe ───
  const copyNote = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note);
      showToast('Copied to clipboard');
    } catch { showToast('Copy failed — please copy manually'); }
  };

  const wipeAll = () => {
    setNote(''); setGeneratedMeta(null);
    setNameFlags([]); setPhiFlags([]);
    setFreeText(''); setBullets('');
    setStructured({ presenting: '', content: '', interventionsText: '', response: '', plan: '' });
    setVoiceSample(''); setVoiceOn(false);
    setInterventions([]); setOtherIntervention('');
    setMse({});
    setRisk(L.RISK_ITEMS.reduce((acc, r) => { acc[r.key] = { status: null, note: '' }; return acc; }, {}));
    setConfirming(false);
    try { localStorage.removeItem('pn.drafts'); } catch {}
    showToast('Note erased');
  };

  const sections = useMemo(() => {
    if (!note) return [];
    return L.parseNote(note, generatedMeta?.format || format);
  }, [note, format, generatedMeta]);

  const toggleIntervention = (name) =>
    setInterventions((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const ToneControl = tweaks.toneStyle === 'dial' ? ToneDial
    : tweaks.toneStyle === 'stacked' ? ToneStacked
    : ToneSegmented;

  const openTweaks = () => window.postMessage({ type: '__activate_edit_mode' }, '*');

  const otherCount = otherIntervention.split(',').map((s) => s.trim()).filter(Boolean).length;
  const totalInterventions = interventions.length + otherCount;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark" />
          <h1>Progress Note Writer</h1>
          <span className="tag">De-identified · for Writers</span>
        </div>
        <div className="meta">
          <span className="hipaa-badge" title="HIPAA Safe Harbor de-identification runs on-device before any content is sent to the AI.">
            <Icon.shield />HIPAA Safe Harbor
          </span>
          <span><span className="dot" />Nothing saved · in-memory only</span>
          <button
            className={apiKey ? 'btn ghost' : 'btn'}
            style={{ padding: '4px 10px', fontSize: 11.5, height: 'auto' }}
            onClick={() => setShowKeyModal(true)}
            title={apiKey ? 'API key configured — click to update' : 'Enter your Anthropic API key to generate notes'}
          >
            <Icon.key />{apiKey ? 'API key ✓' : 'Set API key'}
          </button>
          <button
            className="btn ghost"
            style={{ padding: '4px 8px', fontSize: 11.5, height: 'auto' }}
            onClick={openTweaks}
            title="Appearance settings"
          >
            <Icon.sliders />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        {/* ──── Privacy / HIPAA ──── */}
        <div className="card hipaa-card">
          <h3>Privacy <span className="hint">HIPAA Safe Harbor</span></h3>
          <div className="hipaa-grid">
            <div className="hipaa-cell"><b>Names</b><span>auto-detected, replaced with {subject}</span></div>
            <div className="hipaa-cell"><b>SSNs · Phones · Emails</b><span>regex-redacted before send</span></div>
            <div className="hipaa-cell"><b>Dates · ZIPs · MRNs</b><span>tokenized as [TYPE-REDACTED]</span></div>
            <div className="hipaa-cell"><b>Ages 90+ · IPs · URLs</b><span>removed per §164.514(b)</span></div>
          </div>
          <div className="row h" style={{ marginTop: 12, marginBottom: 0 }}>
            <label style={{ margin: 0 }}>Safe Harbor de-identification</label>
            <button className="tg" data-on={safeHarbor ? '1' : '0'} onClick={() => setSafeHarbor(!safeHarbor)}><i /></button>
          </div>
          <div className="note-sm" style={{ marginTop: 8 }}>
            Notes are never stored by this tool. Use "Note completed" to permanently erase when done. Confirm your AI provider's Business Associate Agreement before entering identifiable PHI.
          </div>
        </div>

        {/* ──── Note settings ──── */}
        <div className="card">
          <h3>Note settings <span className="hint">Format & voice</span></h3>

          <div className="row">
            <label>Format</label>
            <select className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
              {Object.entries(L.FORMATS).map(([k, f]) => (
                <option key={k} value={k}>{f.full}</option>
              ))}
            </select>
          </div>

          <div className="row">
            <label>Refer to subject as</label>
            <div className="seg" role="radiogroup">
              <button type="button" aria-pressed={subject === 'Client'} onClick={() => setSubject('Client')}>Client</button>
              <button type="button" aria-pressed={subject === 'Patient'} onClick={() => setSubject('Patient')}>Patient</button>
            </div>
          </div>

          <div className="row">
            <label>Clinical tone</label>
            <ToneControl value={tone} onChange={setTone} />
          </div>
        </div>

        {/* ──── Writer's voice ──── */}
        <div className="card">
          <h3>Writer's voice <span className="hint">Optional</span></h3>
          <div className="row h">
            <label style={{ margin: 0 }}>Preserve my voice</label>
            <button className="tg" data-on={voiceOn ? '1' : '0'} onClick={() => setVoiceOn(!voiceOn)}><i /></button>
          </div>
          {voiceOn && (
            <div className="voice-detail">
              <div className="slider-row">
                <div className="row h" style={{ margin: 0 }}>
                  <label style={{ margin: 0 }}>Preservation strength</label>
                  <span className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{voiceStrength}%</span>
                </div>
                <input type="range" className="slider" min="0" max="100" step="5"
                       value={voiceStrength}
                       onChange={(e) => setVoiceStrength(Number(e.target.value))} />
              </div>
              <div className="row" style={{ margin: 0 }}>
                <label>Voice sample (paste a past note)</label>
                <textarea className="textarea" rows="4"
                          placeholder="Paste 1–2 of your prior notes so the tool can mirror your phrasing. Names are stripped before generation."
                          value={voiceSample}
                          onChange={(e) => setVoiceSample(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ──── Session content ──── */}
        <div className="card">
          <h3>Session content <span className="hint">Required</span></h3>

          <div className="tabs">
            <button aria-pressed={inputMode === 'free'} onClick={() => setInputMode('free')}>Free text</button>
            <button aria-pressed={inputMode === 'structured'} onClick={() => setInputMode('structured')}>Structured</button>
            <button aria-pressed={inputMode === 'bullets'} onClick={() => setInputMode('bullets')}>Bullets</button>
          </div>

          {inputMode === 'free' && (
            <textarea className="textarea" rows="8"
                      placeholder={`Describe the session in your own words. Mention themes, what the ${subject.toLowerCase()} discussed, interventions you used, and how they responded.`}
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)} />
          )}

          {inputMode === 'structured' && (
            <>
              {[
                ['presenting', 'Presenting issue / focus'],
                ['content', 'Content discussed'],
                ['interventionsText', 'Interventions used in session'],
                ['response', `${subject}'s response`],
                ['plan', 'Plan / next steps'],
              ].map(([k, label]) => (
                <div className="row" key={k}>
                  <label>{label}</label>
                  <textarea className="textarea" rows="2"
                            value={structured[k]}
                            onChange={(e) => setStructured((s) => ({ ...s, [k]: e.target.value }))} />
                </div>
              ))}
            </>
          )}

          {inputMode === 'bullets' && (
            <textarea className="textarea" rows="8"
                      placeholder={`- ${subject.toLowerCase()} reported low mood this week\n- explored cognitive distortions around work\n- reviewed thought record\n- assigned: continue thought log, schedule one social activity`}
                      value={bullets}
                      onChange={(e) => setBullets(e.target.value)} />
          )}

          <div className="note-sm" style={{ marginTop: 10 }}>
            Names in your input are auto-detected and replaced with {subject} before generation. Dates, places, and other context remain unless you remove them.
          </div>
        </div>

        {/* ──── Interventions ──── */}
        <div className="card">
          <h3>Interventions <span className="hint">{totalInterventions || 'none'} selected</span></h3>
          <div className="chips">
            {L.INTERVENTIONS.map((i) => (
              <button key={i} className="chip"
                      aria-pressed={interventions.includes(i)}
                      onClick={() => toggleIntervention(i)}>{i}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
            <label>Other (not listed)</label>
            <input className="input" type="text"
                   placeholder="e.g. Somatic Experiencing, Gestalt chair work (comma-separated)"
                   value={otherIntervention}
                   onChange={(e) => setOtherIntervention(e.target.value)} />
          </div>
        </div>

        {/* ──── Risk assessment ──── */}
        <div className="card">
          <h3>Risk assessment</h3>
          {L.RISK_ITEMS.map(({ key, label }) => {
            const r = risk[key];
            const setStatus = (s) => setRisk((x) => ({ ...x, [key]: { ...x[key], status: s } }));
            const setRiskNote = (n) => setRisk((x) => ({ ...x, [key]: { ...x[key], note: n } }));
            return (
              <div className="risk-row" key={key}>
                <div>
                  <div className="name">{label}</div>
                  {(r.status === 'endorsed' || r.status === 'active') && (
                    <input className="input" style={{ marginTop: 6, fontSize: 12, padding: '6px 9px' }}
                           placeholder="Detail (optional)"
                           value={r.note}
                           onChange={(e) => setRiskNote(e.target.value)} />
                  )}
                </div>
                <div className="tri">
                  <button aria-pressed={r.status === 'denied'} onClick={() => setStatus('denied')}>Denied</button>
                  <button className="endorsed" aria-pressed={r.status === 'endorsed'} onClick={() => setStatus('endorsed')}>Endorsed</button>
                  <button className="active" aria-pressed={r.status === 'active'} onClick={() => setStatus('active')}>Active</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ──── Mental status exam ──── */}
        <div className="card">
          <h3>Mental status exam <span className="hint">Quick fill</span></h3>
          <div className="mse">
            {L.MSE_FIELDS.map((f) => (
              <div className="mse-cell" key={f.key}>
                <label>{f.label}</label>
                <select className="select"
                        value={mse[f.key] || ''}
                        onChange={(e) => setMse((m) => ({ ...m, [f.key]: e.target.value }))}>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o || '—'}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main" id="note-pane">
        <div className="note-toolbar">
          <div className="left">
            {generatedMeta && (
              <span style={{ fontSize: 12 }}>
                Generated {generatedMeta.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </div>
          <div className="actions">
            <button className="btn" disabled={!note || loading} onClick={copyNote}>
              <Icon.copy />Copy
            </button>
            <button className="btn danger" disabled={!note || loading} onClick={() => setConfirming(true)}>
              <Icon.check />Note completed
            </button>
            <button className="btn primary" disabled={loading || !!note} onClick={generate}
                    title={note ? 'Mark the current note completed before starting a new one' : ''}>
              {loading ? <span className="spin" /> : <Icon.spark />}
              {loading ? 'Generating…' : 'Generate note'}
            </button>
          </div>
        </div>

        {(nameFlags.length > 0 || phiFlags.length > 0) && (
          <div className="flag-bar">
            <div style={{ flex: 1 }}>
              <div className="lbl">De-identified before generation</div>
              <ul>
                {nameFlags.map((n) => <li key={'n-' + n}>Name: {n}</li>)}
                {phiFlags.map((p, i) => <li key={'p-' + i}>{p.kind}: {p.value}</li>)}
              </ul>
            </div>
          </div>
        )}

        <article className={`paper ${loading ? 'loading' : ''}`}>
          {note ? (
            <>
              <div className="meta">
                <span className="fmt">{L.FORMATS[generatedMeta?.format || format].full}</span>
                <span>Writer · De-identified</span>
              </div>
              {sections.map((s, i) => (
                <div key={i}>
                  {s.heading && <h2 className="note-section">{s.heading}</h2>}
                  {s.body.split(/\n{2,}/).map((para, j) => (
                    <p key={j}>{para.split('\n').map((line, k) => (
                      <React.Fragment key={k}>{line}{k < para.split('\n').length - 1 && <br />}</React.Fragment>
                    ))}</p>
                  ))}
                </div>
              ))}
            </>
          ) : loading ? (
            <>
              <div className="meta"><span className="fmt">Drafting…</span><span>Writer</span></div>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div className="gen-line" key={i} style={{ width: `${65 + (i * 7) % 30}%` }} />
              ))}
            </>
          ) : (
            <div className="empty">
              <div className="icon"><Icon.page /></div>
              <h4>Your note will appear here</h4>
              <div>Fill in session content on the left, then press Generate note.</div>
              {!apiKey && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn primary" onClick={() => setShowKeyModal(true)}>
                    <Icon.key />Set API key to begin
                  </button>
                </div>
              )}
            </div>
          )}
        </article>
      </main>

      <TweaksPanel title="Appearance">
        <TweakSection label="Color theme">
          <TweakSelect label="Theme" value={tweaks.theme}
            options={[
              { value: 'warm', label: 'Warm (default)' },
              { value: 'cool', label: 'Cool' },
              { value: 'sage', label: 'Sage' },
              { value: 'graphite', label: 'Graphite' },
            ]}
            onChange={(v) => setTweak('theme', v)} />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio label="Density" value={tweaks.density}
            options={['compact', 'regular', 'comfy']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Tone scale style">
          <TweakSelect label="Control" value={tweaks.toneStyle}
            options={[
              { value: 'segmented', label: 'Segmented (default)' },
              { value: 'dial', label: 'Slider dial' },
              { value: 'stacked', label: 'Stacked cards' },
            ]}
            onChange={(v) => setTweak('toneStyle', v)} />
        </TweakSection>
      </TweaksPanel>

      {toast}

      {/* Mobile jump-to-note FAB */}
      <a className="jump-fab" href="#note-pane" style={{ display: 'none' }}
         ref={(el) => {
           if (!el) return;
           const sync = () => { el.style.display = window.innerWidth <= 900 ? 'inline-flex' : 'none'; };
           sync();
           window.addEventListener('resize', sync);
         }}>
        <Icon.page className="ico" />Jump to note
      </a>

      {/* Erase confirmation modal */}
      {confirming && (
        <div className="modal-backdrop" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Erase this note?</h3>
            <p>
              This permanently wipes the note, the session content you entered, and every side-panel selection. <strong>It cannot be recovered.</strong> Make sure you have already copied the note into your record before continuing.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn danger solid" onClick={wipeAll}>Yes, erase permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* API key modal */}
      {showKeyModal && (
        <ApiKeyModal
          currentKey={apiKey}
          onSave={saveApiKey}
          onCancel={apiKey ? () => setShowKeyModal(false) : null}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
