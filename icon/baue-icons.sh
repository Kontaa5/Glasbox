#!/bin/bash
# Erzeugt aus keepway-hell.svg / keepway-dunkel.svg:
#   - extension/icons/icon{16,32,48,128}.png  (Erweiterung, helle Variante)
#   - icon/keepway-512.png                    (Fenster-/Favicon im Container)
#   - icon/AppIcon.icon (Icon Composer) und Keepway.app mit Hell/Dunkel/Getönt (macOS wählt selbst)
# Braucht Xcode (swiftc, actool). Nur nötig, wenn sich das Icon ändert.
set -euo pipefail
ICON="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$ICON")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

swiftc -O "$ICON/render.swift" -o "$TMP/render"
mkdir -p "$ROOT/extension/icons"
for px in 16 32 48 128; do
  "$TMP/render" "$ICON/keepway-hell.svg" "$ROOT/extension/icons/icon$px.png" "$px"
done
"$TMP/render" "$ICON/keepway-hell.svg" "$ICON/keepway-512.png" 512

# App-Icon im Icon-Composer-Format (macOS 26): Ebenen aus dem SVG, Hintergrund hell/dunkel.
# macOS erzeugt daraus Hell, Dunkel und Getönt selbst.
python3 -I "$ICON/ebenen.py" "$ICON/keepway-hell.svg" "$ICON/AppIcon.icon"

APP="$ROOT/Keepway.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
xcrun actool "$ICON/AppIcon.icon" --compile "$APP/Contents/Resources" --platform macosx \
  --minimum-deployment-target 26.0 --app-icon AppIcon --output-partial-info-plist "$TMP/partial.plist" >/dev/null
cp "$ICON/Info.plist" "$APP/Contents/Info.plist"
cp "$ICON/start-app.sh" "$APP/Contents/MacOS/Keepway"
chmod 755 "$APP/Contents/MacOS/Keepway"
codesign --force --sign - "$APP" 2>/dev/null
echo "✓ Icons + Keepway.app gebaut"
