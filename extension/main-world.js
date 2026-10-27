// Läuft im Seitenkontext (MAIN world): meldet Web Worker, WebAssembly, Datei-Picker sowie
// Berechtigungs-Anfragen, Fingerprinting-Versuche und Schreiben in die Zwischenablage.
// Typisch für Krypto-Miner: viele Worker + WebAssembly. Die Seite könnte das fälschen –
// es ist nur ein Hinweis, die echte Messung ist der CPU-Verbrauch.
(() => {
  const melde = (art) => window.dispatchEvent(new CustomEvent('sb-signal', { detail: art }));

  // art: fester Name oder Funktion (args -> Name oder null = nicht melden)
  const umhuelle = (obj, name, art) => {
    const original = obj && obj[name];
    if (typeof original !== 'function') return;
    const meldeFuer = (args) => {
      try { const a = typeof art === 'function' ? art(args) : art; if (a) melde(a); } catch { /* egal */ }
    };
    obj[name] = new Proxy(original, {
      construct(ziel, args, neuesZiel) { meldeFuer(args); return Reflect.construct(ziel, args, neuesZiel); },
      apply(ziel, dies, args) { meldeFuer(args); return Reflect.apply(ziel, dies, args); },
    });
  };

  umhuelle(window, 'Worker', 'worker');
  umhuelle(window, 'SharedWorker', 'worker');
  if (typeof WebAssembly === 'object') {
    for (const f of ['instantiate', 'instantiateStreaming', 'compile', 'compileStreaming', 'Module']) {
      umhuelle(WebAssembly, f, 'wasm');
    }
  }
  umhuelle(window, 'showOpenFilePicker', 'filepicker');

  // Berechtigungen (alle per Richtlinie gesperrt – hier nur sichtbar machen, wer fragt)
  if (window.MediaDevices) umhuelle(MediaDevices.prototype, 'getUserMedia', 'perm-kamera');
  if (window.Geolocation) {
    umhuelle(Geolocation.prototype, 'getCurrentPosition', 'perm-standort');
    umhuelle(Geolocation.prototype, 'watchPosition', 'perm-standort');
  }
  if (window.Notification) umhuelle(Notification, 'requestPermission', 'perm-mitteilung');

  // Fingerprinting: Bild einer Zeichenfläche bzw. Audio-Fingerabdruck auslesen
  if (window.HTMLCanvasElement) {
    umhuelle(HTMLCanvasElement.prototype, 'toDataURL', 'fp-canvas');
    umhuelle(HTMLCanvasElement.prototype, 'toBlob', 'fp-canvas');
  }
  if (window.CanvasRenderingContext2D) umhuelle(CanvasRenderingContext2D.prototype, 'getImageData', 'fp-canvas');
  umhuelle(window, 'OfflineAudioContext', 'fp-audio');

  // Zwischenablage beschreiben (z. B. Betrugsseiten, die einen Befehl unterschieben)
  if (window.Clipboard) {
    umhuelle(Clipboard.prototype, 'writeText', 'clip-schreiben');
    umhuelle(Clipboard.prototype, 'write', 'clip-schreiben');
  }
  umhuelle(Document.prototype, 'execCommand', (args) =>
    /^(copy|cut)$/i.test(String(args[0])) ? 'clip-schreiben' : null);
})();
