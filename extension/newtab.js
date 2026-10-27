import { ladeConfig, istWebUrl, kuerzen, wendeDesignAn, DESIGNS, SCHRIFT_NAMEN, sitzungsAussehen } from './lib.js';

// Alles wird mit textContent / createElement gebaut – nie innerHTML mit fremden Daten.
const $ = (id) => document.getElementById(id);

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

function uhrzeit(ms) {
  return new Date(ms).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Suche ----------
$('suche').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  const sieht_wie_url = /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(q) && !q.includes(' ');
  const ziel = istWebUrl(q) ? q
    : sieht_wie_url ? 'https://' + q
    : 'https://search.brave.com/search?q=' + encodeURIComponent(q);
  location.href = ziel;
});

// ---------- IP ----------
// Länderkürzel (nur zwei Großbuchstaben, oben geprüft) -> Flaggen-Emoji
function flagge(land) {
  return land ? String.fromCodePoint(...[...land].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
}
async function ladeIp(config) {
  $('ip').textContent = '…';
  $('ip-ort').textContent = '';
  $('ip-org').textContent = '';
  const status = $('ip-status');
  status.className = 'status';
  status.textContent = 'prüfe…';
  try {
    let daten;
    try {
      const r = await fetch('https://ipinfo.io/json', { cache: 'no-store', credentials: 'omit' });
      daten = await r.json();
    } catch {
      const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', credentials: 'omit' });
      daten = await r.json();
    }
    const ip = typeof daten.ip === 'string' ? daten.ip : '?';
    const org = typeof daten.org === 'string' ? daten.org : '';
    const land = typeof daten.country === 'string' && /^[A-Z]{2}$/.test(daten.country) ? daten.country : '';
    const ort = [daten.city, daten.region].filter((x) => typeof x === 'string' && x).join(', ');
    $('ip').textContent = kuerzen(ip, 60);
    $('ip-ort').textContent = [flagge(land), kuerzen(ort, 80), land].filter(Boolean).join(' ');
    $('ip-org').textContent = kuerzen(org.replace(/^AS\d+\s+/, ''), 80);

    const heim = config.heim_provider.find((p) => org.toLowerCase().includes(p.toLowerCase()));
    if (heim) {
      status.className = 'status warn';
      status.textContent = 'Achtung: Heim-Anbieter „' + kuerzen(heim, 40) + '“ – VPN aus?';
    } else if (config.heim_provider.length) {
      status.className = 'status ok';
      status.textContent = 'Nicht dein Heim-Anbieter';
    } else {
      status.textContent = 'Heim-Anbieter in einstellungen.json eintragen für VPN-Warnung';
    }
  } catch {
    $('ip').textContent = 'nicht erreichbar';
    status.className = 'status warn';
    status.textContent = 'Keine Verbindung?';
  }
}

// ---------- Listen ----------
function fuelleListe(listeId, zahlId, eintraege, zeile, leerText) {
  const ul = $(listeId);
  ul.replaceChildren();
  $(zahlId).textContent = String(eintraege.length);
  $(zahlId).className = 'zahl' + (eintraege.length ? ' warn' : '');
  if (!eintraege.length) {
    ul.append(el('li', 'leer', leerText));
    return;
  }
  for (const e of eintraege.slice(0, 50)) {
    const li = el('li');
    li.append(el('span', 'zeit', uhrzeit(e.zeit)), document.createTextNode(zeile(e)));
    ul.append(li);
  }
}

function prozent(n) {
  return Number.isFinite(n) ? Math.round(n) + ' %' : '–';
}

function zeigePerf(perf, config) {
  const tbody = $('perf-liste');
  tbody.replaceChildren();
  const zeilen = Object.values(perf).sort((a, b) => b.max - a.max);
  if (!zeilen.length) {
    const tr = el('tr');
    const td = el('td', 'leise', 'Noch keine Seiten besucht.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const p of zeilen.slice(0, 50)) {
    const schnitt = p.messungen ? p.summe / p.messungen : NaN;
    const tr = el('tr');
    let stufe = 'ok';
    let text = 'unauffällig';
    if (p.hoch) { stufe = 'hoch'; text = 'hoher Verbrauch' + (p.hochZeit ? ' (' + uhrzeit(p.hochZeit) + ')' : ''); }
    else if (p.max >= config.cpu_warnung_prozent || (p.worker > 3 && p.wasm > 0)) { stufe = 'mittel'; text = 'auffällig'; }
    const status = el('td');
    status.append(el('span', 'badge ' + stufe, text));
    tr.append(
      el('td', '', kuerzen(p.seite, 80)),
      el('td', '', prozent(schnitt)),
      el('td', '', prozent(p.max)),
      el('td', '', String(p.worker)),
      el('td', '', String(p.wasm)),
      status,
    );
    tbody.append(tr);
  }
}

function kachel(name, url) {
  const a = el('a');
  a.href = url; // nur geprüfte http(s)-URLs
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* bleibt url */ }
  const titel = kuerzen(name || host, 60);
  // Buchstabe statt Favicon: lädt nichts von der Seite. Farbe nur aus einer Zahl berechnet.
  let h = 0;
  for (const c of host) h = (h * 31 + c.charCodeAt(0)) % 360;
  const zeichen = el('span', 'zeichen', (titel.trim()[0] || '?').toUpperCase());
  zeichen.style.setProperty('--farbe', String(h));
  const text = el('span', 'text');
  text.append(el('span', 'name', titel), el('small', '', kuerzen(host, 60)));
  a.append(zeichen, text);
  return a;
}

async function zeigeLesezeichen(config) {
  const box = $('lz-liste');
  box.replaceChildren();
  for (const b of config.lesezeichen) box.append(kachel(b.name, b.url));
  const baum = await chrome.bookmarks.getTree();
  const sammle = (knoten) => knoten.flatMap((k) => (k.url ? [k] : sammle(k.children || [])));
  for (const b of sammle(baum)) {
    if (istWebUrl(b.url)) box.append(kachel(b.title, b.url));
  }
  if (!box.children.length) box.append(el('span', 'leise', 'Keine Lesezeichen.'));
}

function groesse(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  return bytes < 1e6 ? Math.round(bytes / 1e3) + ' KB' : (bytes / 1e6).toFixed(1) + ' MB';
}

async function zeigeLaborDownloads() {
  const items = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 50 });
  fuelleListe('dl-liste', 'dl-zahl', items.map((i) => ({ ...i, zeit: Date.parse(i.startTime) })),
    (i) => kuerzen(i.filename.split('/').pop(), 80) + ' · ' + groesse(i.fileSize || i.totalBytes) + ' · ' + i.state,
    'Noch nichts heruntergeladen');
}

async function zeigeAlles(config) {
  const d = await chrome.storage.local.get(['downloads', 'uploads', 'weiterleitungen', 'perf']);
  if (config.labor) {
    await zeigeLaborDownloads();
  } else {
    fuelleListe('dl-liste', 'dl-zahl', d.downloads || [],
      (e) => (e.datei || e.url) + (e.seite ? ' – von ' + e.seite : ''), 'Nichts heruntergeladen ✓');
  }
  fuelleListe('ul-liste', 'ul-zahl', d.uploads || [],
    (e) => e.seite + ' – ' + e.art, 'Keine Upload-Versuche ✓');
  fuelleListe('wl-liste', 'wl-zahl', d.weiterleitungen || [],
    (e) => kuerzen(e.von, 60) + ' → ' + kuerzen(e.nach, 60) + ' (' + e.art + ')', 'Keine ✓');
  zeigePerf(d.perf || {}, config);
}

async function zeigeDesign() {
  const wahl = await wendeDesignAn(config);
  for (const b of document.querySelectorAll('.design button')) {
    b.setAttribute('aria-pressed', String(b.dataset.design === wahl));
  }
}

for (const b of document.querySelectorAll('.design button')) {
  b.addEventListener('click', async () => {
    if (DESIGNS.includes(b.dataset.design)) await chrome.storage.local.set({ design: b.dataset.design });
  });
}

// ---------- Aussehen (⚙︎): Schrift und Größe nur für diese Sitzung ----------
async function zeigeAussehen() {
  const { schrift, schriftgroesse } = await sitzungsAussehen(config);
  $('schrift').value = schrift;
  $('groesse').value = String(schriftgroesse);
  $('groesse-wert').textContent = schriftgroesse + ' px';
}

async function setzeAussehen(aenderung) {
  const { aussehen = {} } = await chrome.storage.local.get('aussehen');
  await chrome.storage.local.set({ aussehen: { ...aussehen, ...aenderung } });
}

$('schrift').addEventListener('change', (e) => {
  if (SCHRIFT_NAMEN.includes(e.target.value)) setzeAussehen({ schrift: e.target.value });
});
$('groesse').addEventListener('input', (e) => {
  const g = parseInt(e.target.value, 10);
  if (Number.isInteger(g) && g >= 12 && g <= 20) setzeAussehen({ schriftgroesse: g });
});
$('aussehen-reset').addEventListener('click', async () => {
  await chrome.storage.local.remove(['aussehen', 'design']);
});

function zeigeModus(config) {
  zeigeDesign();
  $('labor').hidden = !config.labor;
  $('dl-info').textContent = config.labor
    ? 'Labor-Modus: Dateien liegen nur im Container (~/Downloads) und werden beim Beenden gelöscht.'
    : 'Downloads sind gesperrt. Hier stehen Versuche.';
}

let config = await ladeConfig();
zeigeModus(config);
zeigeAussehen();
ladeIp(config);
chrome.downloads.onChanged.addListener(() => { if (config.labor) zeigeLaborDownloads(); });
zeigeLesezeichen(config);
zeigeAlles(config);
$('ip-neu').addEventListener('click', () => ladeIp(config));
// Beim Zurückwechseln auf das Dashboard sofort frische Werte zeigen
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') zeigeAlles(config); });
$('perf-ok').addEventListener('click', () => chrome.runtime.sendMessage({ typ: 'warnungQuittieren' }));
chrome.storage.onChanged.addListener(async (_, bereich) => {
  if (bereich === 'managed') {
    config = await ladeConfig();
    zeigeModus(config);
    ladeIp(config);
    zeigeLesezeichen(config);
  }
  if (bereich === 'local' || bereich === 'managed') { zeigeDesign(); zeigeAussehen(); }
  if (bereich === 'local' || bereich === 'managed') zeigeAlles(config);
});
