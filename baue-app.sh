#!/bin/bash
# Baut Keepway.app: eigenständig, der ganze Code steckt in der App (Contents/Resources/keepway).
# Daten liegen in ~/Library/Application Support/Keepway – die App braucht keinen Zugriff auf
# Schreibtisch oder Dokumente und kann z. B. nach „Programme“ gezogen werden.
# Nach jeder Code-Änderung neu ausführen. Braucht die Xcode-Kommandozeilentools (swiftc).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/Keepway.app"
CODE="$APP/Contents/Resources/keepway"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$CODE/docker" "$CODE/icon"
cp "$ROOT/icon/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/icon/kompiliert/AppIcon.icns" "$ROOT/icon/kompiliert/Assets.car" "$APP/Contents/Resources/"
swiftc -O "$ROOT/app/Keepway.swift" -o "$APP/Contents/MacOS/Keepway"
cp "$ROOT/sb" "$ROOT/einstellungen.beispiel.json" "$CODE/"
cp -R "$ROOT/extension" "$CODE/"
for f in Dockerfile policies.json updates.xml wrapped-brave firewall.sh seccomp-brave.json vorbereiten.py; do
  cp "$ROOT/docker/$f" "$CODE/docker/"
done
cp "$ROOT/icon/keepway-512.png" "$CODE/icon/"
find "$CODE" -name '__pycache__' -prune -exec rm -rf {} +
chmod 755 "$APP/Contents/MacOS/Keepway" "$CODE/sb"
codesign --force --sign - "$APP" 2>/dev/null
echo "✓ Keepway.app gebaut"
