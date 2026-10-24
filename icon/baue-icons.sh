#!/bin/bash
# Erzeugt aus keepway-hell.svg / keepway-dunkel.svg:
#   - extension/icons/icon{16,32,48,128}.png  (Erweiterung, helle Variante)
#   - icon/keepway-512.png                    (Fenster-/Favicon im Container)
#   - icon/AppIcon.icon (Icon Composer) + icon/kompiliert/ (Hell/Dunkel/Getönt, macOS wählt selbst)
#   - danach Keepway.app über ./baue-app.sh
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

# Kompiliertes App-Icon ablegen (damit ./baue-app.sh ohne Xcode auskommt)
rm -rf "$ICON/kompiliert" && mkdir -p "$ICON/kompiliert"
xcrun actool "$ICON/AppIcon.icon" --compile "$ICON/kompiliert" --platform macosx \
  --minimum-deployment-target 26.0 --app-icon AppIcon --output-partial-info-plist "$TMP/partial.plist" >/dev/null
echo "✓ Icons gebaut"
"$ROOT/baue-app.sh"
