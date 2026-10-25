"""Zerlegt glasbox-hell.svg in Ebenen (<g id="ebene-…">) und schreibt ein Icon-Composer-Paket.
Der Hintergrund kommt aus icon.json (hell/dunkel), nicht aus dem SVG.
Aufruf: python3 -I ebenen.py glasbox-hell.svg AppIcon.icon"""
import json
import os
import re
import shutil
import sys

svg_pfad, ziel = sys.argv[1], sys.argv[2]
svg = open(svg_pfad, encoding="utf-8").read()
defs = re.search(r"<defs>.*?</defs>", svg, re.S).group(0)
kopf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
ebenen = re.findall(r'<g id="ebene-([a-z]+)">(.*?)</g>', svg, re.S)
if not ebenen:
    sys.exit("keine <g id=\"ebene-…\"> im SVG")

shutil.rmtree(ziel, ignore_errors=True)
os.makedirs(os.path.join(ziel, "Assets"))
for name, inhalt in ebenen:
    open(os.path.join(ziel, "Assets", name + ".svg"), "w", encoding="utf-8").write(kopf + defs + inhalt + "</svg>")
# Oberste Ebene zuerst (Icon Composer: erste Gruppe liegt vorne)
gruppen = [{"layers": [{"image-name": name + ".svg", "name": name}]} for name, _ in reversed(ebenen)]
json.dump({
    "fill": {"automatic-gradient": "extended-srgb:0.94000,0.96000,0.98000,1.00000"},
    "fill-specializations": [{"appearance": "dark",
                              "value": {"automatic-gradient": "extended-srgb:0.12000,0.14000,0.18000,1.00000"}}],
    "groups": gruppen,
    "supported-platforms": {"squares": "shared"},
}, open(os.path.join(ziel, "icon.json"), "w", encoding="utf-8"), indent=2)
