#!/usr/bin/python3 -I
"""Hält das Brave-Fenster im Container maximiert (läuft als abc, gestartet von wrapped-brave).

Doppelklick und Ziehen an der Tab-Leiste sind schon gesperrt (glasbox.gschema.override,
fixedPosition in labwc.xml). Der Wächter ist das Sicherheitsnetz für alles andere: Er fragt labwc
etwa 7-mal pro Sekunde (IPC-Socket, nur lesen) und maximiert ein gelöstes Fenster per Kürzel
Super+F23 wieder (in docker/labwc.xml belegt).
"""
import json
import os
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


def taste(name):
    subprocess.run(["wtype", "-M", "logo", "-k", name, "-m", "logo"],
                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=2)


while True:
    time.sleep(0.15)
    try:
        for w in fenster():
            if (isinstance(w, dict) and w.get("focused") and not w.get("maximized")
                    and not w.get("fullscreen") and not w.get("minimized")):
                taste("F23")
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
