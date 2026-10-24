// Läuft im Seitenkontext (MAIN world): meldet Web Worker, WebAssembly und Datei-Picker.
// Typisch für Krypto-Miner: viele Worker + WebAssembly. Die Seite könnte das fälschen –
// es ist nur ein Hinweis, die echte Messung ist der CPU-Verbrauch.
(() => {
  const melde = (art) => window.dispatchEvent(new CustomEvent('sb-signal', { detail: art }));

  const umhuelle = (obj, name, art) => {
    const original = obj && obj[name];
    if (typeof original !== 'function') return;
    obj[name] = new Proxy(original, {
      construct(ziel, args, neuesZiel) { melde(art); return Reflect.construct(ziel, args, neuesZiel); },
      apply(ziel, dies, args) { melde(art); return Reflect.apply(ziel, dies, args); },
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
})();
