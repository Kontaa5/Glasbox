import { istWebUrl } from './lib.js';

let daten = {};
try {
  daten = JSON.parse(decodeURIComponent(location.hash.slice(1)));
} catch {
  daten = {};
}
const von = typeof daten.von === 'string' ? daten.von : '';
const nach = typeof daten.nach === 'string' && istWebUrl(daten.nach) ? daten.nach : '';

document.getElementById('von').textContent = von || '–';
document.getElementById('nach').textContent = nach || '–';

document.getElementById('neu').addEventListener('click', () => {
  location.href = chrome.runtime.getURL('newtab.html');
});

const trotzdem = document.getElementById('trotzdem');
if (!nach) trotzdem.disabled = true;
trotzdem.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ typ: 'einmalErlauben' });
  location.href = nach;
});
