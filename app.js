/* Prototype Sistem Pelacakan Alumni (client-only)
   - Simulasi crawler & evidence
   - Skoring sederhana untuk demo
   - Proof disimpan ke LocalStorage
   - Multi-page: state dibawa via sessionStorage
*/

const els = {
  jsStatus: document.getElementById('jsStatus'),
  crawlerDisabledReason: document.getElementById('crawlerDisabledReason'),
  searchSummary: document.getElementById('searchSummary'),

  btnReset: document.getElementById('btnReset'),
  btnDemo: document.getElementById('btnDemo'),
  profileForm: document.getElementById('profileForm'),
  fullName: document.getElementById('fullName'),
  aliases: document.getElementById('aliases'),
  domicile: document.getElementById('domicile'),
  program: document.getElementById('program'),
  gradYear: document.getElementById('gradYear'),
  campus: document.getElementById('campus'),
  optOut: document.getElementById('optOut'),

  normalizedName: document.getElementById('normalizedName'),
  normalizedAliases: document.getElementById('normalizedAliases'),
  queryList: document.getElementById('queryList'),
  btnCopyQuery: document.getElementById('btnCopyQuery'),

  engine: document.getElementById('engine'),
  resultCount: document.getElementById('resultCount'),
  srcScholar: document.getElementById('srcScholar'),
  srcPublic: document.getElementById('srcPublic'),
  btnRunCrawler: document.getElementById('btnRunCrawler'),
  btnClearEvidence: document.getElementById('btnClearEvidence'),
  btnExportEvidence: document.getElementById('btnExportEvidence'),
  evidenceEmpty: document.getElementById('evidenceEmpty'),
  evidenceList: document.getElementById('evidenceList'),

  topScore: document.getElementById('topScore'),
  statusText: document.getElementById('statusText'),
  btnFinalize: document.getElementById('btnFinalize'),
  btnSaveProof: document.getElementById('btnSaveProof'),
  finalOutput: document.getElementById('finalOutput'),

  proofList: document.getElementById('proofList'),
  btnExportProof: document.getElementById('btnExportProof'),
  btnClearProof: document.getElementById('btnClearProof'),

  // Auth
  btnLogout: document.getElementById('btnLogout'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  authMessage: document.getElementById('authMessage'),
  btnSeedAdmin: document.getElementById('btnSeedAdmin'),
};

const STORAGE_KEYS = {
  proof: 'dp3_proof_v1',
  sessionState: 'dp3_session_state_v1',
  users: 'dp3_users_v1',
  authSession: 'dp3_auth_session_v1',
};

function defaultState(){
  return {
    profile: null,
    queries: [],
    evidence: [],
    finalizedAt: null,
    optOut: false,
  };
}

let state = defaultState();

// Fallback when localStorage is unavailable/blocked
let proofCache = [];

function isPublicPage(){
  return Boolean(globalThis.__DP3_PUBLIC_PAGE__);
}

function getNextUrlParam(){
  try {
    const u = new URL(window.location.href);
    const next = u.searchParams.get('next');
    if(!next) return null;
    // basic safety: only allow local relative paths
    if(next.startsWith('http://') || next.startsWith('https://')) return null;
    if(next.includes('..')) return null;
    return next;
  } catch {
    return null;
  }
}

function getCurrentPathForNext(){
  try {
    const pathname = window.location.pathname.split('/').pop() || 'index.html';
    const qs = window.location.search || '';
    const hash = window.location.hash || '';
    return `${pathname}${qs}${hash}`;
  } catch {
    return 'index.html';
  }
}

function loadUsers(){
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.users);
    if(!raw) return [];
    const parsed = safeJsonParse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users){
  try {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function normalizeUsername(u){
  return String(u || '').trim().toLowerCase();
}

function isValidUsername(u){
  return /^[a-z0-9._]{3,24}$/.test(u);
}

function bytesToHex(bytes){
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex){
  const clean = String(hex || '').trim();
  if(clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for(let i = 0; i < out.length; i++){
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function randomHex(bytesLen){
  const len = Number(bytesLen || 16);
  if(globalThis.crypto && crypto.getRandomValues){
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    return bytesToHex(buf);
  }
  return cryptoRandomId() + cryptoRandomId();
}

async function sha256Hex(input){
  const text = String(input || '');
  if(globalThis.crypto?.subtle){
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return bytesToHex(new Uint8Array(hash));
  }
  // Fallback (not cryptographically secure): simple rolling hash
  let h = 2166136261;
  for(let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function hashPassword(password, saltHex){
  const salt = String(saltHex || '');
  return sha256Hex(`${salt}:${String(password || '')}`);
}

function getAuthSession(){
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.authSession);
    if(!raw) return null;
    const parsed = safeJsonParse(raw);
    if(!parsed || typeof parsed !== 'object') return null;
    if(typeof parsed.username !== 'string') return null;
    return { username: parsed.username, loggedInAt: parsed.loggedInAt };
  } catch {
    return null;
  }
}

function setAuthSession(username){
  try {
    sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify({
      username: normalizeUsername(username),
      loggedInAt: new Date().toISOString(),
    }));
  } catch {
    // ignore
  }
}

function clearAuthSession(){
  try { sessionStorage.removeItem(STORAGE_KEYS.authSession); } catch { /* ignore */ }
}

function requireAuthOrRedirect(){
  if(isPublicPage()) return true;
  const sess = getAuthSession();
  if(sess && sess.username) return true;

  const next = encodeURIComponent(getCurrentPathForNext());
  window.location.href = `auth.html?next=${next}`;
  return false;
}

async function ensureDefaultAdmin(){
  const users = loadUsers();
  const existing = users.find(u => u?.username === 'admin');
  if(existing) return false;

  const salt = randomHex(16);
  const passHash = await hashPassword('admin123', salt);
  users.push({
    username: 'admin',
    salt,
    passHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);
  return true;
}

function safeJsonParse(raw){
  try { return JSON.parse(raw); } catch { return null; }
}

function loadSessionState(){
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.sessionState);
    if(!raw) return defaultState();
    const parsed = safeJsonParse(raw);
    if(!parsed || typeof parsed !== 'object') return defaultState();

    const next = defaultState();
    next.profile = (parsed.profile && typeof parsed.profile === 'object') ? parsed.profile : null;
    next.queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    next.evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
    next.finalizedAt = typeof parsed.finalizedAt === 'string' ? parsed.finalizedAt : null;
    next.optOut = Boolean(parsed.optOut);
    return next;
  } catch {
    return defaultState();
  }
}

function saveSessionState(){
  try {
    sessionStorage.setItem(STORAGE_KEYS.sessionState, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function setElDisabled(el, disabled){
  if(!el) return;
  el.disabled = Boolean(disabled);
}

function isOptedOut(){
  // single source of truth: state.optOut
  return Boolean(state.optOut);
}

function getQueriesFromTextarea(){
  const raw = normalizeSpaces(els.queryList?.value || '');
  if(!raw) return [];
  return raw
    .split(/\r?\n/)
    .map(s => normalizeSpaces(s))
    .filter(Boolean);
}

function ensureQueriesInState(){
  if(Array.isArray(state.queries) && state.queries.length > 0) return;
  const fromUi = getQueriesFromTextarea();
  if(fromUi.length > 0) state.queries = fromUi;
}

function normalizeSpaces(s){
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normalizeName(s){
  const clean = normalizeSpaces(s)
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s.'-]/g, '');
  return clean;
}

function splitAliases(s){
  const raw = normalizeSpaces(s);
  if(!raw) return [];
  return raw
    .split(',')
    .map(x => normalizeName(x))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

function tokenize(s){
  return normalizeName(s)
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

function buildQueries(profile){
  const name = normalizeName(profile.fullName);
  const aliasList = splitAliases(profile.aliases);
  const domicile = normalizeSpaces(profile.domicile);
  const program = normalizeSpaces(profile.program);
  const campus = normalizeSpaces(profile.campus);
  const gradYear = normalizeSpaces(profile.gradYear);

  const base = [
    `"${profile.fullName}"`,
    aliasList.length ? `("${aliasList.join('" OR "')}")` : '',
    domicile ? `"${domicile}"` : '',
    program ? `"${program}"` : '',
    campus ? `"${campus}"` : '',
    gradYear ? `"${gradYear}"` : '',
  ].filter(Boolean).join(' ');

  const q = [];
  q.push(base);

  if(program) q.push(`${profile.fullName} ${program} ${domicile}`.trim());
  if(campus) q.push(`${profile.fullName} ${campus} alumni`.trim());
  if(domicile) q.push(`${profile.fullName} ${domicile} profil`.trim());
  if(aliasList[0]) q.push(`${aliasList[0]} ${program || ''} ${campus || ''}`.trim());

  return q
    .map(normalizeSpaces)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);
}

function clamp(n, min, max){
  return Math.max(min, Math.min(max, n));
}

function scoreEvidence(profile, ev){
  const nameTokens = tokenize(profile.fullName);
  const aliasTokens = splitAliases(profile.aliases).flatMap(tokenize);
  const programTokens = tokenize(profile.program);
  const domicileTokens = tokenize(profile.domicile);
  const campusTokens = tokenize(profile.campus);

  const text = `${ev.title} ${ev.snippet} ${ev.site}`;
  const tokens = new Set(tokenize(text));

  const countHits = (wanted) => wanted.reduce((acc, t) => acc + (tokens.has(t) ? 1 : 0), 0);

  const nameHits = countHits(nameTokens);
  const aliasHits = countHits(aliasTokens);
  const programHits = countHits(programTokens);
  const domicileHits = countHits(domicileTokens);
  const campusHits = countHits(campusTokens);

  const sourceWeight = (ev.source === 'scholar' || ev.source === 'openalex') ? 1.15 : 1.0;

  const raw =
    (nameHits * 18) +
    (aliasHits * 10) +
    (programHits * 8) +
    (domicileHits * 6) +
    (campusHits * 8) +
    (ev.hasProfileKeyword ? 6 : 0) +
    (ev.hasAlumniKeyword ? 6 : 0);

  const normalized = clamp(Math.round(raw * sourceWeight), 0, 100);

  const reasons = [];
  if(nameHits) reasons.push(`nama(${nameHits})`);
  if(aliasHits) reasons.push(`alias(${aliasHits})`);
  if(programHits) reasons.push(`prodi(${programHits})`);
  if(domicileHits) reasons.push(`domisili(${domicileHits})`);
  if(campusHits) reasons.push(`kampus(${campusHits})`);
  if(ev.hasProfileKeyword) reasons.push('keyword:profil');
  if(ev.hasAlumniKeyword) reasons.push('keyword:alumni');

  return { score: normalized, reasons: reasons.join(', ') || '-' };
}

function getEvidenceSourceLabel(kind){
  switch(String(kind || '').toLowerCase()){
    case 'openalex': return 'OpenAlex (API)';
    case 'google': return 'Google (simulasi)';
    case 'bing': return 'Bing (simulasi)';
    default: return 'Simulasi';
  }
}

function buildOpenAlexSearchText(profile, queries){
  const parts = [];
  const name = normalizeSpaces(profile?.fullName);
  if(name) parts.push(name);

  const program = normalizeSpaces(profile?.program);
  const campus = normalizeSpaces(profile?.campus);
  const domicile = normalizeSpaces(profile?.domicile);

  // Keep it simple and resilient: use some profile fields + first 1-2 queries
  if(program) parts.push(program);
  if(campus) parts.push(campus);
  if(domicile) parts.push(domicile);

  const q = Array.isArray(queries) ? queries : [];
  for(const item of q.slice(0, 2)){
    const cleaned = normalizeSpaces(String(item || '').replace(/"/g, ''));
    if(cleaned) parts.push(cleaned);
  }

  return normalizeSpaces(parts.join(' ')).slice(0, 240);
}

function openalexWorkToEvidence(work, profile){
  const title = normalizeSpaces(work?.title) || '(Tanpa judul)';

  const year = work?.publication_year || '';
  const venue = normalizeSpaces(work?.primary_location?.source?.display_name) || '';
  const authors = Array.isArray(work?.authorships)
    ? work.authorships
      .map(a => normalizeSpaces(a?.author?.display_name))
      .filter(Boolean)
      .slice(0, 4)
    : [];

  const url =
    normalizeSpaces(work?.doi_url) ||
    normalizeSpaces(work?.primary_location?.landing_page_url) ||
    normalizeSpaces(work?.id) ||
    'https://openalex.org';

  let site = 'openalex.org';
  try { site = new URL(url).hostname || site; } catch { /* ignore */ }

  const snippetParts = [];
  if(authors.length) snippetParts.push(`author: ${authors.join(', ')}`);
  if(venue) snippetParts.push(`venue: ${venue}`);
  if(year) snippetParts.push(`year: ${year}`);
  snippetParts.push('metadata publik (OpenAlex)');

  const snippet = snippetParts.join(' · ');
  const lower = `${title} ${snippet} ${site}`.toLowerCase();

  const hasProfileKeyword = lower.includes('profil');
  const hasAlumniKeyword = lower.includes('alumni');

  const ev = {
    id: cryptoRandomId(),
    source: 'openalex',
    engine: 'openalex',
    site,
    url,
    title,
    snippet,
    hasProfileKeyword,
    hasAlumniKeyword,
    verified: false,
    createdAt: new Date().toISOString(),
  };

  const { score, reasons } = scoreEvidence(profile, ev);
  ev.score = score;
  ev.reasons = reasons;
  return ev;
}

async function fetchOpenAlexEvidence(profile, queries, opts){
  const perPage = clamp(Number(opts?.resultCount || 10), 3, 20);
  const searchText = buildOpenAlexSearchText(profile, queries);
  if(!searchText) return [];

  const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchText)}&per_page=${perPage}&sort=relevance_score:desc`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if(!res.ok){
      throw new Error(`OpenAlex HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = Array.isArray(data?.results) ? data.results : [];
    const mapped = items.map(w => openalexWorkToEvidence(w, profile));
    mapped.sort((a, b) => b.score - a.score);
    return mapped;
  } finally {
    clearTimeout(t);
  }
}

function seededRng(seedStr){
  // xorshift32 based on simple hash
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = h >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function makeFakeEvidence(profile, queries, opts){
  const rng = seededRng(`${profile.fullName}|${opts.engine}|${queries.join('|')}`);
  const sources = [];
  if(opts.srcScholar) sources.push('scholar');
  if(opts.srcPublic) sources.push('public');

  const count = Number(opts.resultCount || 10);
  const results = [];

  const orgs = ['Dinas Kominfo', 'Kementerian', 'Startup', 'Universitas', 'Politeknik', 'Rumah Sakit', 'Lab Riset'];
  const roles = ['Software Engineer', 'Data Analyst', 'Research Assistant', 'Dosen', 'Staf IT', 'Product Manager', 'Mahasiswa S2'];
  const domainsScholar = ['scholar.google.com', 'sinta.kemdikbud.go.id'];
  const domainsPublic = ['news.example.org', 'instansi.example.go.id', 'company.example.com', 'medium.example.net'];

  const fullName = normalizeSpaces(profile.fullName);
  const aliasList = splitAliases(profile.aliases).map(a => a.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '));
  const domicile = normalizeSpaces(profile.domicile);
  const program = normalizeSpaces(profile.program);
  const campus = normalizeSpaces(profile.campus);
  const gradYear = normalizeSpaces(profile.gradYear);

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  for(let i = 0; i < count; i++){
    const source = sources.length ? pick(sources) : 'public';
    const site = source === 'scholar' ? pick(domainsScholar) : pick(domainsPublic);

    const nameVariant = (rng() < 0.75) ? fullName : (aliasList[0] || fullName);
    const org = pick(orgs);
    const role = pick(roles);

    const hasProfileKeyword = rng() < 0.55;
    const hasAlumniKeyword = rng() < 0.45;

    const parts = [];
    parts.push(nameVariant);
    if(role && rng() < 0.7) parts.push(role);
    if(org && rng() < 0.65) parts.push(org);
    if(program && rng() < 0.55) parts.push(program);
    if(campus && rng() < 0.5) parts.push(campus);

    const title = parts.join(' — ');

    const snippetBits = [];
    if(hasProfileKeyword) snippetBits.push('profil');
    if(hasAlumniKeyword) snippetBits.push('alumni');
    if(domicile && rng() < 0.6) snippetBits.push(domicile);
    if(gradYear && rng() < 0.35) snippetBits.push(`angkatan ${gradYear}`);
    if(program && rng() < 0.55) snippetBits.push(program);
    snippetBits.push('ringkasan publik dan metadata singkat');

    const snippet = snippetBits.join(' · ');

    const urlSlug = encodeURIComponent(`${nameVariant}-${org}-${role}-${i}`.toLowerCase().replace(/%20/g, '-'));
    const url = `https://${site}/p/${urlSlug}`;

    const ev = {
      id: cryptoRandomId(),
      source,
      engine: opts.engine,
      site,
      url,
      title,
      snippet,
      hasProfileKeyword,
      hasAlumniKeyword,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    const { score, reasons } = scoreEvidence(profile, ev);
    ev.score = score;
    ev.reasons = reasons;

    results.push(ev);
  }

  results.sort((a,b) => b.score - a.score);
  return results;
}

function cryptoRandomId(){
  if (globalThis.crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return `${buf[0].toString(16)}${buf[1].toString(16)}`;
  }
  return String(Math.random()).slice(2);
}

function setDisabled(){
  const optedOut = isOptedOut();

  if(els.optOut){
    els.optOut.checked = optedOut;
  }

  // Profiling
  for (const el of [els.fullName, els.aliases, els.domicile, els.program, els.gradYear, els.campus]) {
    setElDisabled(el, optedOut);
  }
  setElDisabled(els.btnCopyQuery, optedOut || state.queries.length === 0);

  // Crawler
  const uiQueries = getQueriesFromTextarea();
  const hasQueries = (state.queries.length > 0) || (uiQueries.length > 0);

  // Keep this clickable to avoid getting stuck in a disabled state;
  // block execution in click handler if prerequisites are not met.
  setElDisabled(els.btnRunCrawler, optedOut);
  setElDisabled(els.btnClearEvidence, optedOut || state.evidence.length === 0);
  setElDisabled(els.btnExportEvidence, optedOut || state.evidence.length === 0);

  if(els.crawlerDisabledReason){
    if(optedOut){
      els.crawlerDisabledReason.textContent = 'Opt-out aktif: crawler dinonaktifkan.';
    } else if(!hasQueries){
      els.crawlerDisabledReason.textContent = 'Belum ada query. Klik “Generate Query” dulu pada tahap 1.';
    } else {
      els.crawlerDisabledReason.textContent = `Siap. Queries: ${state.queries.length || uiQueries.length}`;
    }
  }

  // Validation
  setElDisabled(els.btnFinalize, optedOut);
  // Keep clickable to avoid getting stuck disabled; block in click handler when not ready.
  setElDisabled(els.btnSaveProof, optedOut);
}

function renderQueries(){
  if(!state.profile){
    if(els.normalizedName) els.normalizedName.textContent = '-';
    if(els.normalizedAliases) els.normalizedAliases.textContent = '-';
    if(els.queryList) els.queryList.value = '';
    return;
  }

  if(els.normalizedName) els.normalizedName.textContent = normalizeName(state.profile.fullName) || '-';
  const aliases = splitAliases(state.profile.aliases);
  if(els.normalizedAliases) els.normalizedAliases.textContent = aliases.length ? aliases.join(' | ') : '-';
  if(els.queryList) els.queryList.value = state.queries.join('\n');
}

function renderEvidence(){
  if(els.evidenceList) els.evidenceList.innerHTML = '';

  if(state.evidence.length === 0){
    if(els.evidenceEmpty) els.evidenceEmpty.style.display = 'block';
    if(els.statusText) els.statusText.textContent = 'Menunggu evidence';
    if(els.topScore) els.topScore.textContent = '-';
    renderSearchSummary();
    return;
  }

  if(els.evidenceEmpty) els.evidenceEmpty.style.display = 'none';

  const verified = state.evidence.filter(e => e.verified);
  const top = verified.length
    ? verified.slice().sort((a, b) => b.score - a.score)[0]
    : state.evidence[0];

  if(els.topScore) els.topScore.textContent = `${top.score} / 100`;
  if(verified.length){
    if(els.statusText) els.statusText.textContent = top.score >= 65
      ? 'Cocok kuat (terverifikasi)'
      : 'Cocok lemah (terverifikasi)';
  } else {
    if(els.statusText) els.statusText.textContent = top.score >= 65
      ? 'Cocok kuat (butuh validasi)'
      : 'Cocok lemah (perlu cek manual)';
  }

  // Jika halaman ini tidak punya evidenceList, cukup update skor/status saja
  if(!els.evidenceList){
    renderSearchSummary();
    return;
  }

  for (const ev of state.evidence) {
    const item = document.createElement('div');
    item.className = 'item';

    const topRow = document.createElement('div');
    topRow.className = 'item-top';

    const left = document.createElement('div');
    left.innerHTML = `<div><strong>${escapeHtml(ev.title)}</strong></div><div class="muted mono">${escapeHtml(ev.url)}</div>`;

    const right = document.createElement('div');
    const tag = ev.source === 'scholar' ? 'Scholar/Sinta'
      : (ev.source === 'openalex' ? 'OpenAlex' : 'Publik');
    right.innerHTML = `<div class="score">${ev.score}</div><div class="tag">${tag}</div>`;

    topRow.appendChild(left);
    topRow.appendChild(right);

    const snippet = document.createElement('div');
    snippet.className = 'muted';
    snippet.textContent = ev.snippet;

    const kv = document.createElement('div');
    kv.className = 'kv';
    kv.innerHTML = `
      <span><strong>Alasan:</strong> ${escapeHtml(ev.reasons)}</span>
      <span><strong>Engine:</strong> ${escapeHtml(ev.engine)} · <strong>Site:</strong> ${escapeHtml(ev.site)}</span>
    `;

    const controls = document.createElement('div');
    controls.className = 'row row-center';

    const verifyLabel = document.createElement('label');
    verifyLabel.className = 'checkbox';
    verifyLabel.innerHTML = `<input type="checkbox" ${ev.verified ? 'checked' : ''} /> <span>Verifikasi manual</span>`;
    verifyLabel.querySelector('input').addEventListener('change', (e) => {
      ev.verified = e.target.checked;
      saveSessionState();
      updateFinalPreview();
      renderEvidence();
      renderProofList();
      renderSearchSummary();
    });

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-ghost';
    openBtn.type = 'button';
    openBtn.textContent = 'Buka Bukti';
    openBtn.addEventListener('click', () => {
      // simulasikan halaman bukti (new tab) tanpa akses eksternal
      const w = window.open('', '_blank');
      if(!w){
        notifyUser('Popup diblokir browser. Izinkan pop-up untuk 127.0.0.1/localhost agar “Buka Bukti” bisa terbuka.');
        return;
      }
      w.document.write(`<!doctype html><meta charset="utf-8"><title>Bukti</title>`);
      w.document.write(`<pre style="white-space:pre-wrap;font:14px system-ui;">${escapeHtml(JSON.stringify(ev, null, 2))}</pre>`);
      w.document.close();
      w.focus();
    });

    controls.appendChild(verifyLabel);
    controls.appendChild(openBtn);

    item.appendChild(topRow);
    item.appendChild(snippet);
    item.appendChild(kv);
    item.appendChild(controls);

    els.evidenceList.appendChild(item);
  }

  renderSearchSummary();
}

function renderSearchSummary(){
  if(!els.searchSummary) return;

  if(isOptedOut()){
    els.searchSummary.textContent = 'Opt-out aktif: pencarian dinonaktifkan.';
    return;
  }
  if(!state.profile){
    els.searchSummary.textContent = 'Belum ada profil. Buka halaman Profiling dan klik “Generate Query”.';
    return;
  }

  const qCount = (state.queries?.length || getQueriesFromTextarea().length);
  if(qCount === 0){
    els.searchSummary.textContent = 'Query belum tersedia. Generate query dulu di Profiling.';
    return;
  }

  if(state.evidence.length === 0){
    const selected = els.engine?.value || 'google';
    els.searchSummary.textContent = `Siap menjalankan crawler. Sumber: ${getEvidenceSourceLabel(selected)} · Queries: ${qCount}.`;
    return;
  }

  const verified = state.evidence.filter(e => e.verified);
  const top = verified.length
    ? verified.slice().sort((a, b) => b.score - a.score)[0]
    : state.evidence[0];
  const basisText = verified.length ? 'verified' : 'top-score';
  const used = state.evidence[0]?.engine || (els.engine?.value || 'google');
  els.searchSummary.textContent = `Sumber: ${getEvidenceSourceLabel(used)} · Evidence: ${state.evidence.length} · Top: ${top.score}/100 · Basis: ${basisText}`;
}

function syncEngineUi(){
  if(!els.engine) return;
  const engine = String(els.engine.value || 'google');
  const isApi = engine === 'openalex';
  // Multi-source chips only apply to simulation
  if(els.srcScholar) els.srcScholar.disabled = isApi;
  if(els.srcPublic) els.srcPublic.disabled = isApi;
}

function updateFinalPreview(){
  if(!els.finalOutput) return;
  if(!state.profile || state.evidence.length === 0){
    els.finalOutput.value = '';
    return;
  }

  const verified = state.evidence.filter(e => e.verified);
  const top = verified.length
    ? verified.slice().sort((a, b) => b.score - a.score)[0]
    : state.evidence[0];

  const summary = {
    alumni: {
      fullName: normalizeSpaces(state.profile.fullName),
      aliases: splitAliases(state.profile.aliases),
      domicile: normalizeSpaces(state.profile.domicile) || null,
      program: normalizeSpaces(state.profile.program) || null,
      gradYear: normalizeSpaces(state.profile.gradYear) || null,
      campus: normalizeSpaces(state.profile.campus) || null,
    },
    match: {
      status: top.score >= 65 ? 'strong_candidate' : 'weak_candidate',
      basis: verified.length ? 'verified' : 'top-score',
      topScore: top.score,
      topEvidence: pickEvidenceFields(top),
      verifiedCount: verified.length,
      verifiedEvidence: verified.slice(0, 3).map(pickEvidenceFields),
    },
    finalizedAt: state.finalizedAt,
    generatedAt: new Date().toISOString(),
  };

  els.finalOutput.value = JSON.stringify(summary, null, 2);
}

function pickEvidenceFields(ev){
  return {
    source: ev.source,
    engine: ev.engine,
    title: ev.title,
    url: ev.url,
    site: ev.site,
    score: ev.score,
    reasons: ev.reasons,
    verified: ev.verified,
  };
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadJson(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function notifyUser(message){
  if(els.statusText){
    els.statusText.textContent = message;
    return;
  }
  if(els.searchSummary){
    els.searchSummary.textContent = message;
    return;
  }
  alert(message);
}

function setAuthMessage(message){
  if(els.authMessage){
    els.authMessage.textContent = message || '';
  }
}

function logoutAndRedirect(){
  clearAuthSession();
  window.location.href = 'auth.html';
}

async function handleLoginSubmit(e){
  e.preventDefault();
  const form = e.currentTarget;
  const username = normalizeUsername(form.querySelector('input[name="username"]')?.value);
  const password = String(form.querySelector('input[name="password"]')?.value || '');

  if(!username || !password){
    setAuthMessage('Username dan password wajib diisi.');
    return;
  }

  const users = loadUsers();
  const user = users.find(u => u?.username === username);
  if(!user){
    setAuthMessage('Akun tidak ditemukan. Silakan registrasi atau buat admin default.');
    return;
  }

  const salt = String(user.salt || '');
  const passHash = await hashPassword(password, salt);
  if(passHash !== user.passHash){
    setAuthMessage('Password salah.');
    return;
  }

  setAuthSession(username);
  setAuthMessage('Login berhasil. Mengalihkan...');

  const next = getNextUrlParam();
  window.location.href = next || 'index.html';
}

async function handleRegisterSubmit(e){
  e.preventDefault();
  const form = e.currentTarget;
  const username = normalizeUsername(form.querySelector('input[name="username"]')?.value);
  const password = String(form.querySelector('input[name="password"]')?.value || '');
  const password2 = String(form.querySelector('input[name="password2"]')?.value || '');

  if(!isValidUsername(username)){
    setAuthMessage('Username tidak valid. Gunakan huruf/angka/titik/underscore, 3–24 karakter.');
    return;
  }
  if(password.length < 6){
    setAuthMessage('Password minimal 6 karakter.');
    return;
  }
  if(password !== password2){
    setAuthMessage('Password tidak sama.');
    return;
  }

  const users = loadUsers();
  if(users.some(u => u?.username === username)){
    setAuthMessage('Username sudah dipakai.');
    return;
  }

  const salt = randomHex(16);
  const passHash = await hashPassword(password, salt);
  users.push({
    username,
    salt,
    passHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);

  setAuthSession(username);
  setAuthMessage('Registrasi berhasil. Mengalihkan...');
  const next = getNextUrlParam();
  window.location.href = next || 'index.html';
}

function loadProof(){
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.proof);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return Array.isArray(proofCache) ? proofCache : [];
  }
}

function saveProof(list){
  proofCache = Array.isArray(list) ? list : [];
  try {
    localStorage.setItem(STORAGE_KEYS.proof, JSON.stringify(proofCache));
  } catch {
    // localStorage may be blocked by browser privacy settings
    notifyUser('Gagal menyimpan ke LocalStorage (diblokir). Proof tetap tersimpan sementara selama tab ini terbuka.');
  }
}

function renderProofList(){
  if(!els.proofList) return;
  const list = loadProof();
  els.proofList.innerHTML = '';

  if(list.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `<div class="empty-title">Belum ada proof</div><div class="muted">Klik “Simpan Bukti” setelah ada evidence.</div>`;
    els.proofList.appendChild(empty);
    return;
  }

  for (const p of list.slice().reverse()) {
    const item = document.createElement('div');
    item.className = 'item';

    const title = document.createElement('div');
    title.innerHTML = `<strong>${escapeHtml(p.alumniName)}</strong> <span class="muted">· ${new Date(p.savedAt).toLocaleString()}</span>`;

    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `TopScore: ${p.topScore} · Verified: ${p.verifiedCount} · Evidence: ${p.evidenceCount}`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-ghost';
    viewBtn.type = 'button';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
      const w = window.open('', '_blank');
      if(!w){
        notifyUser('Popup diblokir browser. Izinkan pop-up untuk 127.0.0.1/localhost agar “View” bisa terbuka.');
        return;
      }
      w.document.write(`<!doctype html><meta charset="utf-8"><title>Proof</title>`);
      w.document.write(`<pre style="white-space:pre-wrap;font:14px system-ui;">${escapeHtml(JSON.stringify(p, null, 2))}</pre>`);
      w.document.close();
      w.focus();
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost';
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => {
      downloadJson(`proof-${sanitizeFilename(p.alumniName)}.json`, p);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(exportBtn);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(actions);

    els.proofList.appendChild(item);
  }
}

function sanitizeFilename(s){
  return String(s || 'alumni')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'alumni';
}

function resetAll(){
  state = defaultState();
  if(els.profileForm) els.profileForm.reset();

  if(els.normalizedName) els.normalizedName.textContent = '-';
  if(els.normalizedAliases) els.normalizedAliases.textContent = '-';
  if(els.queryList) els.queryList.value = '';
  if(els.finalOutput) els.finalOutput.value = '';

  if(els.statusText) els.statusText.textContent = 'Menunggu evidence';
  if(els.topScore) els.topScore.textContent = '-';

  saveSessionState();
  renderEvidence();
  renderQueries();
  updateFinalPreview();
  renderProofList();
  renderSearchSummary();
  setDisabled();
}

function handleOptOutChange(){
  if(!els.optOut) return;
  state.optOut = Boolean(els.optOut.checked);
  if(state.optOut){
    state.profile = null;
    state.queries = [];
    state.evidence = [];
    state.finalizedAt = null;

    if(els.queryList) els.queryList.value = '';
    if(els.finalOutput) els.finalOutput.value = '';
    if(els.normalizedName) els.normalizedName.textContent = '-';
    if(els.normalizedAliases) els.normalizedAliases.textContent = '-';
    if(els.statusText) els.statusText.textContent = 'Opt-out aktif';
    if(els.topScore) els.topScore.textContent = '-';
  }
  saveSessionState();
  renderEvidence();
  renderQueries();
  updateFinalPreview();
  renderSearchSummary();
  setDisabled();
}

function applyDemo(){
  if(!els.fullName) return;
  els.fullName.value = 'Rina Putri';
  if(els.aliases) els.aliases.value = 'Rina P., R. Putri';
  if(els.domicile) els.domicile.value = 'Bandung';
  if(els.program) els.program.value = 'Teknik Informatika';
  if(els.gradYear) els.gradYear.value = '2023';
  if(els.campus) els.campus.value = 'Universitas Contoh';
}

if(els.profileForm){
  els.profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(isOptedOut()) return;

    const profile = {
      fullName: normalizeSpaces(els.fullName?.value),
      aliases: normalizeSpaces(els.aliases?.value),
      domicile: normalizeSpaces(els.domicile?.value),
      program: normalizeSpaces(els.program?.value),
      gradYear: normalizeSpaces(els.gradYear?.value),
      campus: normalizeSpaces(els.campus?.value),
    };

    state.profile = profile;
    state.queries = buildQueries(profile);
    state.evidence = [];
    state.finalizedAt = null;

    saveSessionState();
    renderQueries();
    renderEvidence();
    updateFinalPreview();
    renderSearchSummary();
    setDisabled();
  });
}

if(els.btnCopyQuery && els.queryList){
  els.btnCopyQuery.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.queryList.value);
      els.btnCopyQuery.textContent = 'Copied';
      setTimeout(() => els.btnCopyQuery.textContent = 'Copy Queries', 900);
    } catch {
      // fallback
      els.queryList.focus();
      els.queryList.select();
      document.execCommand('copy');
    }
  });
}

if(els.btnRunCrawler){
  els.btnRunCrawler.addEventListener('click', async () => {
    if(isOptedOut()){
      notifyUser('Opt-out aktif: crawler dinonaktifkan.');
      return;
    }
    if(!state.profile){
      notifyUser('Belum ada profil. Buka halaman Profiling dan klik “Generate Query”.');
      return;
    }

  // Defensive sync: in some cases UI may have queries but state.queries is empty
  ensureQueriesInState();

  const uiQueries = getQueriesFromTextarea();
  const hasQueries = (state.queries.length > 0) || (uiQueries.length > 0);
  if(!hasQueries){
    if(els.crawlerDisabledReason){
      els.crawlerDisabledReason.textContent = 'Belum ada query. Klik “Generate Query” dulu pada tahap 1.';
    }
    return;
  }

    const opts = {
      engine: els.engine?.value || 'google',
      resultCount: els.resultCount?.value || '10',
      srcScholar: Boolean(els.srcScholar?.checked),
      srcPublic: Boolean(els.srcPublic?.checked),
    };

    const btnText = els.btnRunCrawler.textContent;
    els.btnRunCrawler.textContent = 'Mengambil evidence...';
    setElDisabled(els.btnRunCrawler, true);

    try {
      if(opts.engine === 'openalex'){
        const apiEvidence = await fetchOpenAlexEvidence(state.profile, state.queries, opts);
        if(apiEvidence.length === 0){
          notifyUser('OpenAlex tidak mengembalikan hasil. Fallback ke simulasi.');
          state.evidence = makeFakeEvidence(state.profile, state.queries, { ...opts, engine: 'google' });
        } else {
          state.evidence = apiEvidence;
        }
      } else {
        state.evidence = makeFakeEvidence(state.profile, state.queries, opts);
      }
    } catch (err){
      notifyUser(`Gagal mengambil OpenAlex. Fallback ke simulasi. (${err?.message || 'error'})`);
      state.evidence = makeFakeEvidence(state.profile, state.queries, { ...opts, engine: 'google' });
    } finally {
      els.btnRunCrawler.textContent = btnText;
      setElDisabled(els.btnRunCrawler, false);
    }

    state.finalizedAt = null;

    saveSessionState();
    renderEvidence();
    updateFinalPreview();
    renderSearchSummary();
    setDisabled();
  });
}

if(els.engine){
  els.engine.addEventListener('change', () => {
    syncEngineUi();
    renderSearchSummary();
  });
}

if(els.btnClearEvidence){
  els.btnClearEvidence.addEventListener('click', () => {
    state.evidence = [];
    state.finalizedAt = null;
    saveSessionState();
    renderEvidence();
    updateFinalPreview();
    renderSearchSummary();
    setDisabled();
  });
}

if(els.btnExportEvidence){
  els.btnExportEvidence.addEventListener('click', () => {
    if(state.evidence.length === 0) return;
    downloadJson('evidence.json', {
      profile: state.profile,
      queries: state.queries,
      evidence: state.evidence.map(pickEvidenceFields),
      exportedAt: new Date().toISOString(),
    });
  });
}

if(els.btnFinalize){
  els.btnFinalize.addEventListener('click', () => {
    if(isOptedOut()){
      notifyUser('Opt-out aktif: finalisasi dinonaktifkan.');
      return;
    }
    if(!state.profile){
      notifyUser('Isi profil terlebih dahulu lalu klik “Generate Query”.');
      return;
    }
    if(state.evidence.length === 0){
      notifyUser('Jalankan crawler terlebih dahulu untuk mendapatkan evidence.');
      return;
    }

    state.finalizedAt = new Date().toISOString();
    saveSessionState();
    updateFinalPreview();

  const verified = state.evidence.filter(e => e.verified);
  const top = verified.length
    ? verified.slice().sort((a, b) => b.score - a.score)[0]
    : state.evidence[0];

    if(top.score >= 65){
      notifyUser(verified.length ? 'Finalisasi selesai (skor kuat, terverifikasi).' : 'Finalisasi selesai (skor kuat).');
    } else {
      notifyUser(verified.length ? 'Finalisasi selesai (skor lemah, terverifikasi).' : 'Finalisasi selesai, tapi perlu review (skor lemah).');
    }
  });
}

if(els.btnSaveProof){
  els.btnSaveProof.addEventListener('click', () => {
    if(isOptedOut()){
      notifyUser('Opt-out aktif: simpan bukti dinonaktifkan.');
      return;
    }
    if(!state.profile){
      notifyUser('Isi profil terlebih dahulu lalu klik “Generate Query”.');
      return;
    }
    if(state.evidence.length === 0){
      notifyUser('Belum ada evidence. Jalankan crawler terlebih dahulu.');
      return;
    }

    const verified = state.evidence.filter(e => e.verified);
    const top = verified.length
      ? verified.slice().sort((a, b) => b.score - a.score)[0]
      : state.evidence[0];
    const verifiedCount = verified.length;

  const proof = {
    id: cryptoRandomId(),
    alumniName: normalizeSpaces(state.profile.fullName),
    savedAt: new Date().toISOString(),
    topScore: top.score,
    verifiedCount,
    evidenceCount: state.evidence.length,
    queries: state.queries.slice(),
    topEvidence: pickEvidenceFields(top),
    evidence: state.evidence.map(pickEvidenceFields),
  };

    const list = loadProof();
    list.push(proof);
    saveProof(list);
    renderProofList();
    notifyUser('Bukti tersimpan. Lihat “Riwayat Bukti (Local)”.');
  });
}

if(els.btnExportProof){
  els.btnExportProof.addEventListener('click', () => {
    const list = loadProof();
    downloadJson('proof-history.json', { items: list, exportedAt: new Date().toISOString() });
  });
}

if(els.btnClearProof){
  els.btnClearProof.addEventListener('click', () => {
    saveProof([]);
    renderProofList();
  });
}

if(els.btnReset){
  els.btnReset.addEventListener('click', resetAll);
}

if(els.btnDemo){
  els.btnDemo.addEventListener('click', () => {
    if(els.optOut && els.optOut.checked){
      els.optOut.checked = false;
      state.optOut = false;
    }
    applyDemo();
    if(els.profileForm){
      // Auto-generate queries so crawler becomes enabled
      if(typeof els.profileForm.requestSubmit === 'function'){
        els.profileForm.requestSubmit();
      } else {
        els.profileForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  });
}

if(els.optOut){
  els.optOut.addEventListener('change', handleOptOutChange);
}

// init
function bindAuthUi(){
  if(els.btnLogout){
    els.btnLogout.addEventListener('click', logoutAndRedirect);
  }

  if(els.btnSeedAdmin){
    els.btnSeedAdmin.addEventListener('click', async () => {
      const created = await ensureDefaultAdmin();
      setAuthMessage(created ? 'Admin default dibuat. Silakan login: admin / admin123' : 'Admin default sudah ada. Silakan login.');
    });
  }

  if(els.loginForm){
    els.loginForm.addEventListener('submit', (e) => {
      handleLoginSubmit(e);
    });
  }

  if(els.registerForm){
    els.registerForm.addEventListener('submit', (e) => {
      handleRegisterSubmit(e);
    });
  }
}

function initApp(){
  state = loadSessionState();

  if(els.jsStatus){
    els.jsStatus.textContent = 'JS: aktif';
  }
  renderEvidence();
  renderQueries();
  renderProofList();
  renderSearchSummary();
  setDisabled();
}

bindAuthUi();

// Auth gate (semua halaman selain auth.html wajib login)
const authOk = isPublicPage() ? true : requireAuthOrRedirect();
if(authOk){
  initApp();
}
