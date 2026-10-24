// Isolierter Kontext: sammelt Signale, meldet Upload-Versuche, schickt alle 5 s einen „Tick“
// (der Hintergrund misst dann den CPU-Verbrauch und ordnet ihn dieser Seite zu).
(() => {
  const zaehler = { worker: 0, wasm: 0 };
  let letzterUpload = 0;

  const upload = (art) => {
    if (Date.now() - letzterUpload < 1000) return;
    letzterUpload = Date.now();
    chrome.runtime.sendMessage({ typ: 'upload', art }).catch(() => {});
  };

  const beiSignal = (e) => {
    if (e.detail === 'worker' || e.detail === 'wasm') {
      zaehler[e.detail] = Math.min(zaehler[e.detail] + 1, 9999);
    } else if (e.detail === 'filepicker') {
      upload('Datei-Picker (API)');
    }
  };
  const beiKlick = (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === 'file') upload('Dateifeld');
  };
  const beiDrop = (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) upload('Drag & Drop');
  };

  // document.open()/document.write() löscht alle Listener (z. B. bei Editor-iframes).
  // Gleiche Funktion erneut anmelden ist ein No-op, falls sie noch da ist.
  const anmelden = () => {
    window.addEventListener('sb-signal', beiSignal);
    document.addEventListener('click', beiKlick, true);
    document.addEventListener('drop', beiDrop, true);
  };
  anmelden();

  setInterval(() => {
    anmelden();
    const sichtbar = window === window.top && document.visibilityState === 'visible';
    if (!sichtbar && zaehler.worker === 0 && zaehler.wasm === 0) return;
    chrome.runtime.sendMessage({ typ: 'tick', sichtbar, ...zaehler }).catch(() => {});
    zaehler.worker = 0;
    zaehler.wasm = 0;
  }, 2000);
})();
