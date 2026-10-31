# Glasbox – Übergabe für KI-Assistenten (alle KIs: Claude, Codex, Cursor, Gemini …)

Lies das zuerst. Hier steht, **was Glasbox ist, was schon gebaut wurde und wie der Besitzer arbeiten will.**
Diese Datei ist die einzige Quelle. `CLAUDE.md` bindet sie nur ein.

## Wie der Besitzer arbeiten will (verbindlich)

- **Antworten kurz, Deutsch, Stichworte**, max. ~15 Zeilen. Keine Aufsätze, keine wiederholten Abschnitte.
- **Immer als Checkliste berichten** (auch zwischendurch):
  🔄 mache gerade · ✅ erledigt (+ wie geprüft) · ⚠️ Problem + Ursache · ⏳ offen / brauche dich ·
  🔒 Security – nach jeder Code-Änderung: was geprüft, was offen.
- **Nie „geht nicht“ ohne Prozentzahl** („70 % sicher, weil …“ + wie man es prüft). Erst prüfen, dann behaupten.
- **Probleme lösen, nicht Features abschalten.** („Anstatt es zu lösen hast du es einfach deaktiviert“ – war Kritik.)
  Wenn etwas wirklich nicht sauber geht: ehrlich sagen, mit Prozent, und fragen.
- **Keine Pfusch-Lösungen** (z. B. unsichtbare Boxen über UI-Elementen). Erst gründlich nach dem eleganten Weg suchen.
- **Security ist extrem wichtig** – der Besitzer vertraut dem Programm „sein Leben an“. Bei jeder Änderung mitprüfen.
- **Pushen nur, wenn er es sagt** – dann einmal, ohne Zusatzprüfungen (SSH-Key mit Touch ID/Secretive).
  Keine SSH-/Remote-Befehle von selbst (`git fetch/pull/ls-remote`, ssh-Tests). Prüfen über öffentliches HTTPS.
  Committen ist ok, Push nicht.
- **Nie Schlüsselbund, Passwörter, Systemeinstellungen anfassen** – auch nichts, was ein Keychain-Popup auslöst.
- **Nie die Brave-Profile des Besitzers am Mac lesen oder kopieren.**
- **Keine persönlichen Daten ins Repo** (E-Mail, IP, Provider, Ort). Repo ist öffentlich.
- **Design-Geschmack:** clean, minimal, wenig Text, kurze Erklärungen. Dashboard passt in 100vh ohne Scrollen.
  Nichts einklappbar, was immer gebraucht wird. UI-Texte Deutsch, knapp („Startet …“ statt langer Sätze).
- Nach UI-Änderungen selbst prüfen (Screenshot im Test-Container), nicht den Besitzer testen lassen.

## Grundprinzipien des Produkts

1. **Nichts rein, nichts raus.** Nichts vom Mac auf die Seiten, nichts von den Seiten auf den Mac.
   - Keine Downloads/Uploads zum Mac. Zwischenablage nur Mac → Container, **nie Container → Mac** (bewusst gesperrt).
   - Container sieht keinen Mac-Ordner.
2. **Wegwerfen.** Beim Beenden wird alles gelöscht (Container `--rm`, Volume weg).
3. **Keine dauerhaften Einstellungen über die GUI.** Alles in der App/im Dashboard gilt nur für die Sitzung.
   Dauerhaft nur, wenn der Besitzer selbst `einstellungen.json` bearbeitet. Die App erzeugt dafür nur den
   Text („Für einstellungen.json kopieren“) – sie **schreibt die Datei nie** (Security).
4. **Normal-Modus:** Downloads gesperrt, kein PDF-Betrachter, keine Datei-Dialoge.
   **Labor-Modus:** Downloads nur in den Container, PDFs in Braves Betrachter.
5. Immer **ein** Brave-Fenster, immer maximiert und fest; Inkognito aus.

## Architektur

- **Brave im OrbStack-Docker-Container** (`lscr.io/linuxserver/brave` → eigenes Image `glasbox:local`),
  Bild per Selkies-Stream (labwc/Wayland, x264) auf `127.0.0.1:1111`.
- **Glasbox.app** (`app/Glasbox.swift`, WKWebView) zeigt den Stream. Gebaut mit `./baue-app.sh`
  (ad-hoc signiert, Hardened Runtime). Code + Docker-Dateien stecken in der App.
- **`sb`** (Bash): `start | labor | stop | update | status | log | hochfahren | modus | thema`.
- **Brave-Erweiterung** (`extension/`, MV3, per Policy zwangsinstalliert, eigener CRX-Schlüssel pro Installation):
  Dashboard im neuen Tab, Weiterleitungs-Sperre, Auffälligkeiten, CPU pro Seite.
- **Nutzerdaten** (nicht im Repo): `~/Library/Application Support/Glasbox/`
  (einstellungen.json, keys/, build/, erweiterung.json, modus.json, app.log 0600, Ordner 700).
  Eigenes `DOCKER_CONFIG` dort (umgeht den Keychain-credsStore).

### Dateien

| Datei | Zweck |
|---|---|
| `sb` | Start/Stop, `docker run` mit Härtung, VPN-Check, Image-Bau bei Hash-Änderung |
| `baue-app.sh` | baut Glasbox.app, kopiert docker/ + extension/ hinein, codesign |
| `app/Glasbox.swift` | App: Startfenster (Normal/Labor, ⚙︎ Aussehen), Stream-Fenster, Tastenrouting, Scrollen, Cursor |
| `docker/Dockerfile` | Image: Policies, Erweiterung, Firewall, labwc-Config, Fenster-Wächter, gschema, nginx-Host-Check |
| `docker/policies.json` | ~69 Brave-Enterprise-Policies (JIT aus, LocalNetwork blockiert, Inkognito aus …) |
| `docker/vorbereiten.py` | validiert einstellungen.json → erweiterung.json + modus.json (pro Modus) |
| `docker/firewall.sh` | fail-closed iptables: private Netze, 198.18.0.0/15, Metadaten gesperrt |
| `docker/labwc.xml` | fixedPosition, unMaximizeThreshold 100000, nur Kürzel Super+F23 → Maximize |
| `docker/fenster-waechter.py` | maximiert gelöste Fenster alle 0,15 s wieder (IPC, nur lesen) |
| `docker/glasbox.gschema.override` | Doppel-/Mittel-/Rechtsklick auf Tab-Leiste: nichts |
| `docker/wrapped-brave` | Brave-Start (`--enable-smooth-scrolling`, Sandbox an), startet Wächter |
| `docker/seccomp-*.json`, `make-seccomp.py` | Docker-Default + clone/unshare/chroot für Chromium-Sandbox |
| `extension/background.js` | Weiterleitungen, Downloads, Perf-Messung (alle 2 s), Auffälligkeiten, ein Fenster |
| `extension/main-world.js` | Hooks: Kamera/Mikro, Standort, Benachrichtigung, Canvas/Audio-Fingerprint, Zwischenablage |
| `extension/newtab.*`, `style.css`, `lib.js` | Dashboard (IP-Karte, 4 Karten, Leistung, Lesezeichen-Kacheln, Aussehen-Zeile) |
| `einstellungen.beispiel.json` | Vorlage für einstellungen.json (inkl. `aussehen`) |

### Security-Modell (nicht abschwächen!)

- Container: `cap-drop ALL` + nur CHOWN, SETUID, SETGID, DAC_OVERRIDE, FOWNER, KILL, NET_ADMIN;
  `no-new-privileges`; eigenes seccomp; chrome-sandbox **nicht** setuid; **kein `--no-sandbox`**.
- Port nur `127.0.0.1:1111`; nginx antwortet nur bei Host `127.0.0.1` (sonst 403).
- Selkies: Datei-Transfer aus, Mikro/Webcam/Teilen/Befehle gesperrt, Zwischenablage nur „rein“.
- App: nonPersistent WebView-Store, Content-Rules nur 127.0.0.1:1111 (+ blob:/data:), keine Downloads,
  kein Datei-Dialog, Kamera/Mikro verweigert.
- Erweiterung: Config über managed storage, Prototype-Pollution-Schutz, nie `innerHTML` mit fremden Daten.
- Eingaben aus einstellungen.json / `sb thema` werden validiert (Regex/Whitelist).
- Restrisiko (Kette aus 3 unbekannten Exploits): < 1 %.

## Testen (wichtig)

- **Nie über die laufende Glasbox-Sitzung des Besitzers testen** (Selkies erlaubt nur einen Client).
- Eigenen Test-Container bauen: Image `glasbox:test`, Container `glasbox-test` auf **`127.0.0.1:1112`**,
  mit frischem Daten-Ordner in einem Temp-Verzeichnis (gleiche `docker run`-Flags wie in `sb`, Zeile ~241).
  Bedienen über den eingebauten Browser, Fensterzustand per labwc-IPC (`GET_WINDOWS` auf `/config/.XDG/labwc.sock`).
- Danach **immer aufräumen** (`docker stop glasbox-test`, Image löschen, keine Hintergrund-Container übrig lassen).
- App-Änderungen: `./baue-app.sh`. Das Image baut sich bei Änderung an docker/ oder extension/ automatisch neu.
- Geprüft wurde u. a.: Fenster fest bei Ziehen/Doppelklick/Cmd+Pfeil, Zoom, Perf nach ~4 s,
  FingerprintJS erkannt, Download/PDF im Normal-Modus gesperrt, Weiterleitung fb.com→facebook.com gesperrt,
  Firewall (LAN/OrbStack/Metadaten), Caps/NoNewPrivs/seccomp, Container+Volume nach Stop weg.

## Bedienung (Stand jetzt)

- **Cmd+Plus/Minus/0** zoomt nur die Seite. **Brave-Größe** (Tabs+UI) über **⌘,** („Aussehen …“).
- **⌘,** Aussehen-Fenster: Design (Auto/Hell/Dunkel), Schrift, Schriftgröße 12–20,
  Brave-Größe 75–150 %, Scroll-Tempo 15–100 % (Standard 40 %). Gilt bis Beenden; Snippet für einstellungen.json.
- **Cmd+W** schließt nur den Tab. **Cmd+Q / roter Knopf** fragen nach Beenden (+ alles löschen).
- Cursor blendet nach 10 s ohne Bewegung aus.
- Scrollen: Trackpad ohne macOS-Nachlauf, Tempo-Faktor per JS; Maus als Rasten, Brave scrollt weich.
- Dashboard: IP-Karte (Flagge, Ort, Anbieter, ↻), Downloads/Uploads/Weiterleitungen/Auffälligkeiten,
  Leistung pro Seite, Lesezeichen als Kacheln, Aussehen-Zeile ganz unten. Kein Brave-Search-Lesezeichen.

## Bekannte Grenzen (akzeptiert)

- Trackpad-Scrollen nicht ganz so weich wie nativ – Latenz liegt am Streaming (Besitzer hat akzeptiert).
- Perf-CPU = CPU des ganzen Containers, solange die Seite sichtbar ist (inkl. Stream-Encoding, ~4–10 % Grundlast; 100 % = 4 Kerne).
- Fingerprinting in Workern (z. B. browserleaks) wird nicht erkannt.
- Fenster lässt sich kurz anziehen, springt aber sofort zurück (Wächter).

## Verlauf (Kurzfassung)

Container-Härtung + Firewall · Selkies-Härtung · nginx-Host-Check · Brave-Policies · Erweiterung mit Dashboard ·
Weiterleitungs-Sperre · Mining-/CPU-Erkennung · Auffälligkeiten (Berechtigungen, Fingerprinting, Zwischenablage) ·
Fenster fest (labwc + gschema + Wächter) · nur ein Fenster, Inkognito aus · Zoom nur Seite, Brave-Größe über ⌘, ·
Aussehen nur für die Sitzung + Snippet · Dashboard-Redesign (100vh, Lesezeichen-Kacheln, IP-Karte) ·
Cursor-Ausblenden · weiches Scrollen + Tempo · PDF nur im Labor · Cmd+W = Tab schließen ·
Server-Weiterleitungen vor dem Laden gestoppt (webRequestBlocking) · Beenden prüft Löschen · Reste-Container weg.
Details: `git log`.
