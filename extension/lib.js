// Gemeinsame Helfer für Hintergrund und Seiten der Erweiterung.

const ZWEISTUFIGE_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.at', 'or.at', 'gv.at', 'ac.at',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'com.br', 'com.cn', 'com.tr',
  'co.in', 'co.za', 'com.mx', 'com.ar', 'github.io', 'pages.dev', 'vercel.app',
]);

// Grobe „Seite“ (eTLD+1) einer URL, z. B. https://a.b.example.co.at/x -> example.co.at
export function site(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host) return '';
  if (/^[\d.]+$/.test(host) || host.includes(':')) return host;
  const teile = host.split('.');
  if (teile.length <= 2) return host;
  const letzte2 = teile.slice(-2).join('.');
  return ZWEISTUFIGE_TLDS.has(letzte2) ? teile.slice(-3).join('.') : letzte2;
}

export function istWebUrl(url) {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

const STANDARD = {
  lesezeichen: [],
  heim_provider: [],
  erlaubte_weiterleitungen: [],
  cpu_warnung_prozent: 70,
  cpu_limit: 0,
};

// Einstellungen kommen als Richtlinie (Managed Storage), vom Startskript aus einstellungen.json
// erzeugt und schreibgeschützt eingebunden. Hier trotzdem nochmals geprüft.
export async function ladeConfig() {
  let roh = {};
  try {
    roh = (await chrome.storage.managed.get(null)) || {};
  } catch {
    roh = {};
  }
  const texte = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 200).slice(0, 100) : []);
  const zahl = (v, min, max, std) => (Number.isFinite(v) && v >= min && v <= max ? v : std);
  return {
    lesezeichen: (Array.isArray(roh.lesezeichen) ? roh.lesezeichen : [])
      .filter((b) => b && typeof b.name === 'string' && typeof b.url === 'string' && istWebUrl(b.url))
      .slice(0, 100)
      .map((b) => ({ name: b.name.slice(0, 80), url: b.url })),
    heim_provider: texte(roh.heim_provider),
    erlaubte_weiterleitungen: texte(roh.erlaubte_weiterleitungen).map((s) => s.toLowerCase()),
    cpu_warnung_prozent: zahl(roh.cpu_warnung_prozent, 10, 100, STANDARD.cpu_warnung_prozent),
    cpu_limit: zahl(roh.cpu_limit, 0, 256, STANDARD.cpu_limit),
    labor: roh.labor === true,
    thema: roh.thema === 'hell' || roh.thema === 'dunkel' ? roh.thema : '',
    schrift: Object.hasOwn(SCHRIFTEN, roh.schrift) ? roh.schrift : 'system',
    schriftgroesse: zahl(roh.schriftgroesse, 12, 20, 14),
  };
}

// Design: Wahl im Dashboard (auto/hell/dunkel, gilt für diese Sitzung) – „auto“ folgt dem Mac
// bzw. der Einstellung in der Glasbox-App (kommt als config.thema).
export const DESIGNS = ['auto', 'hell', 'dunkel'];

// Schriften: nur diese festen Werte (kommen aus der Glasbox-App bzw. einstellungen.json → aussehen).
const SCHRIFTEN = {
  system: 'system-ui, "Noto Sans", "DejaVu Sans", sans-serif',
  serif: '"Noto Serif", "DejaVu Serif", "Liberation Serif", serif',
  mono: '"DejaVu Sans Mono", "Liberation Mono", monospace',
  schmal: '"Nimbus Sans Narrow", "Liberation Sans Narrow", sans-serif-condensed, sans-serif',
};

export const SCHRIFT_NAMEN = Object.keys(SCHRIFTEN);

/// Aussehen der Sitzung: im Dashboard (⚙︎) gewählt, überschreibt die Werte aus der App/einstellungen.json.
export async function sitzungsAussehen(config) {
  const { aussehen = {} } = await chrome.storage.local.get('aussehen');
  const schrift = SCHRIFT_NAMEN.includes(aussehen.schrift) ? aussehen.schrift : config.schrift;
  const g = aussehen.schriftgroesse;
  const schriftgroesse = Number.isInteger(g) && g >= 12 && g <= 20 ? g : config.schriftgroesse;
  return { schrift, schriftgroesse };
}

export async function wendeDesignAn(config) {
  const { design } = await chrome.storage.local.get('design');
  const wahl = DESIGNS.includes(design) ? design : 'auto';
  const { schrift, schriftgroesse } = await sitzungsAussehen(config);
  const wurzel = document.documentElement;
  wurzel.dataset.thema = wahl === 'auto' ? config.thema : wahl;
  wurzel.style.setProperty('--schrift', SCHRIFTEN[schrift] || SCHRIFTEN.system);
  wurzel.style.setProperty('--schriftgroesse', schriftgroesse + 'px');
  return wahl;
}

export function kuerzen(text, max = 200) {
  const s = String(text ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
