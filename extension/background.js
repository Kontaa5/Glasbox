import { site, istWebUrl, ladeConfig, kuerzen } from './lib.js';

const MAX_EINTRAEGE = 200;
// configJetzt: dieselbe Config synchron (für die blockierende Weiterleitungs-Prüfung), null bis geladen
let configJetzt = null;
let configPromise = ladeConfig();
configPromise.then((c) => { configJetzt = c; });
// Richtlinien (Managed Storage) kommen evtl. erst nach dem Start an
chrome.storage.onChanged.addListener((_, bereich) => {
  if (bereich !== 'managed') return;
  configPromise = ladeConfig();
  configPromise.then((c) => { configJetzt = c; });
});

// ---------- Protokoll (chrome.storage.local, lebt nur so lange wie der Container) ----------

async function protokolliereJetzt(schluessel, eintrag) {
  const daten = await chrome.storage.local.get(schluessel);
  const liste = daten[schluessel] || [];
  liste.unshift({ zeit: Date.now(), ...eintrag });
  await chrome.storage.local.set({ [schluessel]: liste.slice(0, MAX_EINTRAEGE) });
}

// Schreibzugriffe nacheinander – sonst geht bei zwei gleichzeitigen Einträgen einer verloren
let protokollWarteschlange = Promise.resolve();
function protokolliere(schluessel, eintrag) {
  protokollWarteschlange = protokollWarteschlange.then(() => protokolliereJetzt(schluessel, eintrag)).catch(() => {});
  return protokollWarteschlange;
}

// ---------- Downloads: normal per Richtlinie gesperrt, hier zusätzlich abbrechen + mitschreiben.
// Im Labor-Modus erlaubt (landen nur im Container, beim Beenden gelöscht) – nur mitschreiben. ----------

chrome.downloads.onCreated.addListener(async (item) => {
  const config = await configPromise;
  await protokolliere('downloads', {
    url: kuerzen(item.finalUrl || item.url, 300),
    datei: kuerzen(item.filename || '', 120),
    seite: site(item.referrer || item.url),
    erlaubt: config.labor,
  });
  if (config.labor) return;
  try { await chrome.downloads.cancel(item.id); } catch { /* bereits blockiert */ }
  try { await chrome.downloads.erase({ id: item.id }); } catch { /* egal */ }
});

// ---------- Weiterleitungen auf fremde Seiten blockieren ----------

// tabId -> { url: zuletzt bestätigte URL, angefragt: URL beim Start der Navigation,
//            erlauben: Seite, die nach „Trotzdem öffnen“ genau einmal erreicht werden darf }
async function tabZustand(tabId) {
  const key = 'tab_' + tabId;
  return (await chrome.storage.session.get(key))[key] || {};
}
async function setzeTabZustand(tabId, z) {
  await chrome.storage.session.set({ ['tab_' + tabId]: z });
}

function sperre(tabId, vonUrl, nachUrl, art) {
  protokolliere('weiterleitungen', { von: kuerzen(vonUrl, 300), nach: kuerzen(nachUrl, 300), art });
  const ziel = chrome.runtime.getURL('blocked.html') + '#' +
    encodeURIComponent(JSON.stringify({ von: vonUrl, nach: nachUrl }));
  return setzeTabZustand(tabId, { url: vonUrl }).then(() => chrome.tabs.update(tabId, { url: ziel }));
}

// Server-Weiterleitung (3xx) schon VOR dem Laden der Zielseite stoppen – deren Code läuft so nie.
// Blockierend geht nur synchron (Erweiterung ist per Richtlinie installiert, daher erlaubt).
// Ist die Config noch nicht geladen (Hintergrund gerade aufgewacht), prüft onCommitted unten wie bisher.
try {
  chrome.webRequest.onHeadersReceived.addListener((d) => {
    if (d.type !== 'main_frame' || d.tabId < 0 || d.statusCode < 300 || d.statusCode > 399 || !configJetzt) return;
    const ort = (d.responseHeaders || []).find((h) => h.name.toLowerCase() === 'location');
    if (!ort || typeof ort.value !== 'string') return;
    let nachUrl;
    try { nachUrl = new URL(ort.value, d.url).href; } catch { return; }
    if (!istWebUrl(nachUrl) || !istWebUrl(d.url)) return;
    const von = site(d.url), nach = site(nachUrl);
    if (!von || !nach || von === nach || configJetzt.erlaubte_weiterleitungen.includes(nach)) return;
    sperre(d.tabId, d.url, nachUrl, 'Server, vor dem Laden gestoppt').catch(() => {});
    return { cancel: true };
  }, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] }, ['blocking', 'responseHeaders']);
} catch (e) {
  console.warn('Glasbox: Weiterleitungen nur nach dem Laden prüfbar', e);
}

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const z = await tabZustand(d.tabId);
  z.angefragt = d.url;
  await setzeTabZustand(d.tabId, z);
});

chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0 || !istWebUrl(d.url)) return;
  const z = await tabZustand(d.tabId);
  const q = d.transitionQualifiers || [];
  const serverWeiterleitung = q.includes('server_redirect');
  const clientWeiterleitung = q.includes('client_redirect');

  const vonUrl = serverWeiterleitung ? z.angefragt : z.url;
  const von = vonUrl && istWebUrl(vonUrl) ? site(vonUrl) : '';
  const nach = site(d.url);
  const config = await configPromise;
  // „Trotzdem öffnen“ gilt nur für genau die angezeigte Zielseite, nicht für weitere Sprünge danach
  const erlaubt = z.erlauben === nach || config.erlaubte_weiterleitungen.includes(nach);

  if ((serverWeiterleitung || clientWeiterleitung) && von && nach && von !== nach && !erlaubt) {
    await sperre(d.tabId, vonUrl, d.url, serverWeiterleitung ? 'Server' : 'Seite (JavaScript/Meta)');
    return;
  }
  await setzeTabZustand(d.tabId, { url: d.url });
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('tab_' + tabId));

// Seite sofort in „Leistung pro Seite“ eintragen, nicht erst nach der ersten CPU-Messung
chrome.webNavigation.onCompleted.addListener((d) => {
  if (d.frameId === 0 && istWebUrl(d.url)) aktualisierePerf(site(d.url), null, { worker: 0, wasm: 0 });
});

// ---------- CPU-Verbrauch pro Seite ----------

let letzteMessung = null;
let letzteMessungZeit = 0;
// Startwert gleich beim Aufwachen holen – sonst liefert erst die zweite Messung einen Wert
chrome.system.cpu.getInfo().then((info) => {
  if (letzteMessung) return;
  let belegt = 0, gesamt = 0;
  for (const p of info.processors) { belegt += p.usage.user + p.usage.kernel; gesamt += p.usage.total; }
  letzteMessung = { belegt, gesamt };
}).catch(() => {});
const kurzVerlauf = new Map(); // site -> letzte 3 Werte

async function cpuProzent() {
  const info = await chrome.system.cpu.getInfo();
  let belegt = 0;
  let gesamt = 0;
  for (const p of info.processors) {
    belegt += p.usage.user + p.usage.kernel;
    gesamt += p.usage.total;
  }
  const vorher = letzteMessung;
  letzteMessung = { belegt, gesamt };
  if (!vorher || gesamt <= vorher.gesamt) return null;
  const anteil = (belegt - vorher.belegt) / (gesamt - vorher.gesamt);
  const config = await configPromise;
  // Container ist auf cpu_limit Kerne begrenzt -> darauf normieren (100 % = Limit voll ausgelastet)
  const limit = config.cpu_limit > 0 ? Math.min(config.cpu_limit, info.numOfProcessors) : info.numOfProcessors;
  return Math.min(100, Math.round((anteil * info.numOfProcessors / limit) * 100));
}

// Schreibzugriffe nacheinander (sonst überschreiben sich gleichzeitige Updates gegenseitig)
let perfWarteschlange = Promise.resolve();
function aktualisierePerf(seite, cpu, signale) {
  perfWarteschlange = perfWarteschlange.then(() => perfSchreiben(seite, cpu, signale)).catch(() => {});
  return perfWarteschlange;
}

async function perfSchreiben(seite, cpu, signale) {
  if (!seite || seite === '__proto__' || seite === 'constructor' || seite === 'prototype') return;
  const { perf = {} } = await chrome.storage.local.get('perf');
  // Seitenname kommt aus der URL – nie Objekt-Interna wie __proto__ als Schlüssel nutzen
  const e = (Object.hasOwn(perf, seite) && perf[seite]) || { seite, messungen: 0, summe: 0, max: 0, worker: 0, wasm: 0, hoch: false };
  if (cpu !== null) {
    e.messungen += 1;
    e.summe += cpu;
    e.max = Math.max(e.max, cpu);
    const v = (kurzVerlauf.get(seite) || []).concat(cpu).slice(-3);
    kurzVerlauf.set(seite, v);
    const config = await configPromise;
    const schnitt = v.reduce((a, b) => a + b, 0) / v.length;
    if (v.length === 3 && schnitt >= config.cpu_warnung_prozent && !e.hoch) {
      e.hoch = true;
      e.hochZeit = Date.now();
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    }
  }
  e.worker += signale.worker;
  e.wasm += signale.wasm;
  e.zuletzt = Date.now();
  perf[seite] = e;
  // Größe begrenzen
  const eintraege = Object.values(perf).sort((a, b) => b.zuletzt - a.zuletzt).slice(0, MAX_EINTRAEGE);
  await chrome.storage.local.set({ perf: Object.fromEntries(eintraege.map((x) => [x.seite, x])) });
}

// ---------- Auffälligkeiten (Berechtigungen, Fingerprinting, Zwischenablage) ----------
const AUFFAELLIG = {
  'perm-kamera': 'Kamera/Mikrofon angefragt',
  'perm-standort': 'Standort angefragt',
  'perm-mitteilung': 'Benachrichtigungen angefragt',
  'fp-canvas': 'Fingerprinting (Canvas)',
  'fp-audio': 'Fingerprinting (Audio)',
  'clip-schreiben': 'Zwischenablage beschrieben',
};

// Gleiche Seite + gleiche Art nur einmal pro Sitzung (sonst füllt eine Seite die Liste)
let auffaelligWarteschlange = Promise.resolve();
function merkeAuffaellig(seite, art) {
  auffaelligWarteschlange = auffaelligWarteschlange.then(async () => {
    const { auffaellig = [] } = await chrome.storage.local.get('auffaellig');
    if (auffaellig.some((e) => e.seite === seite && e.art === art)) return;
    await protokolliere('auffaellig', { seite, art });
  }).catch(() => {});
}

function zahlAus(v) {
  return Number.isInteger(v) && v >= 0 && v < 10000 ? v : 0;
}

chrome.runtime.onMessage.addListener((msg, sender, antwort) => {
  if (!msg || typeof msg.typ !== 'string') return;
  const vonErweiterung = sender.id === chrome.runtime.id &&
    typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));

  if (msg.typ === 'tick' && sender.tab && istWebUrl(sender.tab.url)) {
    const seite = site(sender.tab.url);
    const signale = { worker: zahlAus(msg.worker), wasm: zahlAus(msg.wasm) };
    (async () => {
      let cpu = null;
      // höchstens eine Messung je 2 s, nur für den sichtbaren Tab
      if (msg.sichtbar === true && Date.now() - letzteMessungZeit > 2000) {
        letzteMessungZeit = Date.now();
        cpu = await cpuProzent();
      }
      await aktualisierePerf(seite, cpu, signale);
    })();
    return;
  }

  if (msg.typ === 'auffaellig' && sender.tab && istWebUrl(sender.tab.url) && Object.hasOwn(AUFFAELLIG, msg.art)) {
    merkeAuffaellig(site(sender.tab.url), AUFFAELLIG[msg.art]);
    return;
  }

  if (msg.typ === 'upload' && sender.tab && istWebUrl(sender.tab.url)) {
    const art = ['Dateifeld', 'Datei-Picker (API)', 'Drag & Drop'].includes(msg.art) ? msg.art : 'unbekannt';
    protokolliere('uploads', { seite: site(sender.tab.url), url: kuerzen(sender.tab.url, 300), art });
    return;
  }

  // Nur eigene Seiten (Neuer Tab, Sperrseite) dürfen steuern
  if (!vonErweiterung) return;

  if (msg.typ === 'einmalErlauben' && sender.tab && istWebUrl(msg.nach)) {
    const erlauben = site(msg.nach);
    tabZustand(sender.tab.id).then((z) => setzeTabZustand(sender.tab.id, { ...z, erlauben })).then(() => antwort(true));
    return true;
  }
  if (msg.typ === 'warnungQuittieren') {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({}));

// ---------- Nur ein Fenster ----------
// Ein herausgezogener Tab oder Strg+N öffnet sonst ein zweites Brave-Fenster im Container
// (schließt man eines, liegt das andere dahinter). Neue normale Fenster wandern als Tabs ins erste.

async function insHauptfenster(neu) {
  if (neu.type !== 'normal') return;
  for (let versuch = 0; versuch < 40; versuch++) {
    const alle = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
    const fenster = alle.find((w) => w.id === neu.id);
    const haupt = alle.filter((w) => w.id !== neu.id).sort((a, b) => a.id - b.id)[0];
    if (!fenster || !haupt || !fenster.tabs.length) return;
    try {
      const ids = fenster.tabs.map((t) => t.id);
      await chrome.tabs.move(ids, { windowId: haupt.id, index: -1 });
      await chrome.tabs.update(ids[ids.length - 1], { active: true });
      await chrome.windows.update(haupt.id, { focused: true });
      return;
    } catch {
      // z. B. solange der Tab noch mit der Maus gezogen wird – kurz warten und nochmal
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
chrome.windows.onCreated.addListener(insHauptfenster);

// Die Erweiterung wird kurz nach Browserstart per Richtlinie installiert –
// der erste Tab zeigt bis dahin Braves eigene Startseite. Den ersetzen wir.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (!t.url || /^(chrome|brave):\/\/newtab/.test(t.url)) {
      chrome.tabs.update(t.id, { url: chrome.runtime.getURL('newtab.html') });
    }
  }
});
