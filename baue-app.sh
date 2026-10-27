#!/bin/bash
# Baut Glasbox.app: eigenständig, der ganze Code steckt in der App (Contents/Resources/glasbox).
# Daten liegen in ~/Library/Application Support/Glasbox – die App braucht keinen Zugriff auf
# Schreibtisch oder Dokumente und kann z. B. nach „Programme“ gezogen werden.
# Nach jeder Code-Änderung neu ausführen. Braucht die Xcode-Kommandozeilentools (swiftc).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/Glasbox.app"
CODE="$APP/Contents/Resources/glasbox"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$CODE/docker" "$CODE/icon"
cp "$ROOT/icon/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/icon/kompiliert/AppIcon.icns" "$ROOT/icon/kompiliert/Assets.car" "$APP/Contents/Resources/"
swiftc -O "$ROOT/app/Glasbox.swift" -o "$APP/Contents/MacOS/Glasbox"
cp "$ROOT/sb" "$ROOT/einstellungen.beispiel.json" "$CODE/"
cp -R "$ROOT/extension" "$CODE/"
for f in Dockerfile policies.json updates.xml wrapped-brave firewall.sh labwc.xml fenster-waechter.py glasbox.gschema.override seccomp-brave.json vorbereiten.py; do
  cp "$ROOT/docker/$f" "$CODE/docker/"
done
cp "$ROOT/icon/glasbox-512.png" "$CODE/icon/"
find "$CODE" -name '__pycache__' -prune -exec rm -rf {} +
chmod 755 "$APP/Contents/MacOS/Glasbox" "$CODE/sb"
# Hardened Runtime: keine fremden Bibliotheken/DYLD-Variablen in die App einschleusbar
codesign --force --options runtime --sign - "$APP" 2>/dev/null
echo "✓ Glasbox.app gebaut"
