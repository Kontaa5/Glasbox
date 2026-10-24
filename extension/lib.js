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
  };
}

export function kuerzen(text, max = 200) {
  const s = String(text ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
