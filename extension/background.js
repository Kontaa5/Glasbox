import { site, istWebUrl, ladeConfig, kuerzen } from './lib.js';

const MAX_EINTRAEGE = 200;
let configPromise = ladeConfig();
// Richtlinien (Managed Storage) kommen evtl. erst nach dem Start an
chrome.storage.onChanged.addListener((_, bereich) => {
  if (bereich === 'managed') configPromise = ladeConfig();
});

// ---------- Protokoll (chrome.storage.local, lebt nur so lange wie der Container) ----------

async function protokolliere(schluessel, eintrag) {
  const daten = await chrome.storage.local.get(schluessel);
  const liste = daten[schluessel] || [];
  liste.unshift({ zeit: Date.now(), ...eintrag });
  await chrome.storage.local.set({ [schluessel]: liste.slice(0, MAX_EINTRAEGE) });
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

// tabId -> { url: zuletzt bestätigte URL, angefragt: URL beim Start der Navigation, erlauben: bool }
async function tabZustand(tabId) {
  const key = 'tab_' + tabId;
  return (await chrome.storage.session.get(key))[key] || {};
}
async function setzeTabZustand(tabId, z) {
  await chrome.storage.session.set({ ['tab_' + tabId]: z });
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
  const erlaubt = z.erlauben || config.erlaubte_weiterleitungen.includes(nach);

  if ((serverWeiterleitung || clientWeiterleitung) && von && nach && von !== nach && !erlaubt) {
    await protokolliere('weiterleitungen', {
      von: kuerzen(vonUrl, 300),
      nach: kuerzen(d.url, 300),
      art: serverWeiterleitung ? 'Server' : 'Seite (JavaScript/Meta)',
    });
    await setzeTabZustand(d.tabId, { url: vonUrl });
    const ziel = chrome.runtime.getURL('blocked.html') + '#' +
      encodeURIComponent(JSON.stringify({ von: vonUrl, nach: d.url }));
    await chrome.tabs.update(d.tabId, { url: ziel });
    return;
  }
  await setzeTabZustand(d.tabId, { url: d.url });
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('tab_' + tabId));

// ---------- CPU-Verbrauch pro Seite ----------

let letzteMessung = null;
let letzteMessungZeit = 0;
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

async function aktualisierePerf(seite, cpu, signale) {
  const { perf = {} } = await chrome.storage.local.get('perf');
  const e = perf[seite] || { seite, messungen: 0, summe: 0, max: 0, worker: 0, wasm: 0, hoch: false };
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
      // nur eine Messung je 4 s, nur für den sichtbaren Tab
      if (msg.sichtbar === true && Date.now() - letzteMessungZeit > 4000) {
        letzteMessungZeit = Date.now();
        cpu = await cpuProzent();
      }
      await aktualisierePerf(seite, cpu, signale);
    })();
    return;
  }

  if (msg.typ === 'upload' && sender.tab && istWebUrl(sender.tab.url)) {
    const art = ['Dateifeld', 'Datei-Picker (API)', 'Drag & Drop'].includes(msg.art) ? msg.art : 'unbekannt';
    protokolliere('uploads', { seite: site(sender.tab.url), url: kuerzen(sender.tab.url, 300), art });
    return;
  }

  // Nur eigene Seiten (Neuer Tab, Sperrseite) dürfen steuern
  if (!vonErweiterung) return;

  if (msg.typ === 'einmalErlauben' && sender.tab) {
    tabZustand(sender.tab.id).then((z) => setzeTabZustand(sender.tab.id, { ...z, erlauben: true })).then(() => antwort(true));
    return true;
  }
  if (msg.typ === 'warnungQuittieren') {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({}));

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
