"""Bereitet einen Glasbox-Start vor (aufgerufen von ./sb, läuft am Mac).

1. Eigener Signierschlüssel pro Installation (<daten>/keys/extension.pem, nie im Repo)
   -> eigene Erweiterungs-ID, nichts ist bei zwei Klonen gleich.
2. Vorlagen mit dieser ID füllen -> <daten>/build/ (Build-Kontext fürs Image, enthält alles Nötige).
3. <daten>/einstellungen.json prüfen -> <daten>/erweiterung.json (Richtlinie für die Erweiterung)
   und <daten>/modus.json (normal: Downloads gesperrt, labor: erlaubt).

<daten> = ~/Library/Application Support/Glasbox – bewusst nicht im Code-Ordner, damit macOS
keinen Zugriff auf Schreibtisch/Dokumente verlangen muss.

Aufruf: python3 -I docker/vorbereiten.py <codeordner> <datenordner> <normal|labor> [hell|dunkel]
Ausgabe (stdout): "<cpu_kerne> <arbeitsspeicher_gb>"
"""
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
from urllib.parse import urlparse

ordner, daten, modus = sys.argv[1], sys.argv[2], sys.argv[3]
thema = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] in ("hell", "dunkel") else ""
if modus not in ("normal", "labor"):
    sys.exit("Modus muss normal oder labor sein")

keys = os.path.join(daten, "keys")
pem = os.path.join(keys, "extension.pem")
laufzeit = daten
build = os.path.join(daten, "build")

# --- 1. Schlüssel ---
if not os.path.exists(pem):
    os.makedirs(keys, mode=0o700, exist_ok=True)
    subprocess.run(["openssl", "genrsa", "-out", pem, "2048"], check=True, capture_output=True)
    os.chmod(pem, 0o600)
der = subprocess.run(["openssl", "rsa", "-in", pem, "-pubout", "-outform", "DER"],
                     check=True, capture_output=True).stdout
ext_key = base64.b64encode(der).decode()
ext_id = "".join(chr(ord("a") + int(c, 16)) for c in hashlib.sha256(der).hexdigest()[:32])

# --- 2. Vorlagen ---
shutil.rmtree(build, ignore_errors=True)
os.makedirs(build)
for name in ("policies.json", "updates.xml"):
    text = open(os.path.join(ordner, "docker", name), encoding="utf-8").read()
    open(os.path.join(build, name), "w", encoding="utf-8").write(text.replace("__EXT_ID__", ext_id))
shutil.copytree(os.path.join(ordner, "extension"), os.path.join(build, "extension"))
manifest_pfad = os.path.join(build, "extension", "manifest.json")
manifest = json.load(open(manifest_pfad, encoding="utf-8"))
manifest["key"] = ext_key
json.dump(manifest, open(manifest_pfad, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
shutil.copy(pem, os.path.join(build, "extension.pem"))
os.chmod(os.path.join(build, "extension.pem"), 0o600)
for quelle_rel, ziel_name in (("docker/Dockerfile", "Dockerfile"), ("docker/wrapped-brave", "wrapped-brave"), ("docker/firewall.sh", "firewall.sh"), ("docker/labwc.xml", "labwc.xml"), ("docker/fenster-waechter.py", "fenster-waechter.py"),
                              ("docker/seccomp-brave.json", "seccomp-brave.json"), ("icon/glasbox-512.png", "icon.png")):
    shutil.copy(os.path.join(ordner, quelle_rel), os.path.join(build, ziel_name))

# --- 3. Einstellungen ---
quelle = os.path.join(daten, "einstellungen.json")
if not os.path.exists(quelle):
    shutil.copy(os.path.join(ordner, "einstellungen.beispiel.json"), quelle)
try:
    roh = json.load(open(quelle, encoding="utf-8"))
    if not isinstance(roh, dict):
        raise ValueError("oberste Ebene muss ein Objekt sein")
except Exception as e:
    sys.exit(f"einstellungen.json ist kein gültiges JSON: {e}")


def zahl(k, lo, hi, std):
    v = roh.get(k, std)
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else std


def texte(k):
    v = roh.get(k, [])
    return [x for x in v if isinstance(x, str) and 0 < len(x) < 200][:100] if isinstance(v, list) else []


lesezeichen = []
for b in roh.get("lesezeichen", []) if isinstance(roh.get("lesezeichen"), list) else []:
    if isinstance(b, dict) and isinstance(b.get("name"), str) and isinstance(b.get("url"), str):
        u = urlparse(b["url"])
        if u.scheme in ("http", "https") and u.netloc:
            lesezeichen.append({"name": b["name"][:80], "url": b["url"][:2000]})
        else:
            print(f"übersprungen (keine http/https-URL): {b['url'][:80]}", file=sys.stderr)

cpu = zahl("cpu_kerne", 1, 64, 4)
ram = zahl("arbeitsspeicher_gb", 2, 64, 6)
erweiterung = {
    "lesezeichen": lesezeichen[:100],
    "heim_provider": texte("heim_provider"),
    "erlaubte_weiterleitungen": texte("erlaubte_weiterleitungen"),
    "cpu_warnung_prozent": zahl("cpu_warnung_prozent", 10, 100, 70),
    "cpu_limit": cpu,
    "labor": modus == "labor",
    "thema": thema,
}
json.dump({"3rdparty": {"extensions": {ext_id: erweiterung}}},
          open(os.path.join(laufzeit, "erweiterung.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Normal: keine Downloads, keine Dateiauswahl. Labor: beides – aber nur innerhalb des Containers.
if modus == "labor":
    regeln = {"DownloadRestrictions": 0, "AllowFileSelectionDialogs": True,
              "DownloadDirectory": "/config/Downloads", "PromptForDownloadLocation": False}
else:
    regeln = {"DownloadRestrictions": 3, "AllowFileSelectionDialogs": False}
json.dump(regeln, open(os.path.join(laufzeit, "modus.json"), "w", encoding="utf-8"), indent=1)

print(f"{cpu} {ram}")
