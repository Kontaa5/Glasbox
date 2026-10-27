#!/usr/bin/python3 -I
"""Hält das Brave-Fenster im Container maximiert (läuft als abc, gestartet von wrapped-brave).

Brave zeichnet seine Titelleiste selbst: Doppelklick oder Ziehen an der Tab-Leiste löst das
Fenster aus dem Vollbild, und labwc kann das nicht verbieten. Der Wächter fragt labwc etwa
7-mal pro Sekunde (IPC-Socket, nur lesen) und maximiert ein gelöstes Fenster per Kürzel Super+F23
wieder (in docker/labwc.xml belegt). Einmal pro Sekunde prüft er zusätzlich, ob das maximierte
Fenster zur Bildschirmgröße passt (nach schnellem Zoomen), sonst Super+F22 = neu maximieren.
"""
import json
import os
import re
import socket
import subprocess
import time

SOCKET = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/config/.XDG"), "labwc.sock")


def fenster():
    with socket.socket(socket.AF_UNIX) as s:
        s.settimeout(1)
        s.connect(SOCKET)
        s.sendall(b"GET_WINDOWS\n")
        daten = b""
        while len(daten) < 1_000_000:
            teil = s.recv(65536)
            if not teil:
                break
            daten += teil
            try:
                return json.loads(daten)
            except ValueError:
                continue
    return json.loads(daten) if daten else []


def bildschirm():
    """Logische Größe des Bildschirms im Container (Pixel / Skalierung) über wlr-randr."""
    aus = subprocess.run(["wlr-randr"], capture_output=True, text=True, timeout=2).stdout
    modus = re.search(r"(\d+)x(\d+) px[^\n]*current", aus)
    skala = re.search(r"Scale: ([\d.]+)", aus)
    if not modus or not skala or float(skala.group(1)) <= 0:
        return None
    f = float(skala.group(1))
    return round(int(modus.group(1)) / f), round(int(modus.group(2)) / f)


def taste(name):
    subprocess.run(["wtype", "-M", "logo", "-k", name, "-m", "logo"],
                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=2)


runde = 0
zuletzt_neu = 0.0
while True:
    time.sleep(0.15)
    runde += 1
    try:
        for w in fenster():
            if not isinstance(w, dict) or not w.get("focused") or w.get("fullscreen") or w.get("minimized"):
                continue
            if not w.get("maximized"):
                taste("F23")
            elif runde % 7 == 0 and time.monotonic() - zuletzt_neu > 3:
                # Maximiert, aber nach schnellem Zoomen in der alten Größe hängen geblieben?
                b = bildschirm()
                if b and (abs(w.get("width", 0) - b[0]) > 4 or abs(w.get("height", 0) - b[1]) > 4):
                    zuletzt_neu = time.monotonic()
                    taste("F22")
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
