"""Zerlegt keepway-hell.svg in Ebenen und schreibt ein Icon-Composer-Paket (AppIcon.icon).
Aufruf: python3 -I ebenen.py keepway-hell.svg AppIcon.icon"""
import os
import re
import shutil
import sys

svg_pfad, ziel = sys.argv[1], sys.argv[2]
svg = open(svg_pfad, encoding="utf-8").read()
defs = re.search(r"<defs>.*?</defs>", svg, re.S).group(0)
kopf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
punkte, schild, schild_rand, bogen, spitze = re.findall(r"<path [^>]*/>", svg)

shutil.rmtree(ziel, ignore_errors=True)
os.makedirs(os.path.join(ziel, "Assets"))
for name, inhalt in (("pfeil.svg", bogen + spitze), ("schild.svg", schild + schild_rand), ("punkte.svg", punkte)):
    open(os.path.join(ziel, "Assets", name), "w", encoding="utf-8").write(kopf + defs + inhalt + "</svg>")
open(os.path.join(ziel, "icon.json"), "w", encoding="utf-8").write('''{
  "fill" : { "automatic-gradient" : "extended-srgb:0.94000,0.96000,0.98000,1.00000" },
  "fill-specializations" : [
    { "appearance" : "dark", "value" : { "automatic-gradient" : "extended-srgb:0.12000,0.14000,0.18000,1.00000" } }
  ],
  "groups" : [
    { "layers" : [ { "image-name" : "pfeil.svg", "name" : "pfeil" } ] },
    { "layers" : [ { "image-name" : "schild.svg", "name" : "schild" } ] },
    { "layers" : [ { "image-name" : "punkte.svg", "name" : "punkte" } ] }
  ],
  "supported-platforms" : { "squares" : "shared" }
}
''')
