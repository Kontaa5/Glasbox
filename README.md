# Glasbox

<img src="icon/glasbox-512.png" width="96" align="right" alt="Glasbox-Icon">

**Ein Wegwerf-Browser für unsichere Websites.** Glasbox startet Brave in einem abgeschotteten
Container auf deinem Mac. Du siehst und bedienst ihn ganz normal in einem eigenen Fenster – aber
die Webseiten laufen nicht auf deinem Mac, sondern im Container. Beim Beenden wird alles gelöscht:
Verlauf, Cookies, Cache, Dateien.

Nichts vom Mac kommt auf die Seiten, nichts von den Seiten kommt auf den Mac.

> Für macOS (Apple Silicon) mit [OrbStack](https://orbstack.dev). Brave am Mac braucht es nur für `./sb` im Terminal.
> Eine Linux-Version gibt es noch nicht – Pull Requests willkommen.

---

## Features

- **Wegwerf-Browser** – jeder Start ist frisch, beim Beenden ist alles weg.
- **Kein Zugriff auf deine Dateien** – der Container sieht keinen Ordner vom Mac.
- **Downloads gesperrt** (bzw. im Labor-Modus nur im Container), **keine Datei-Uploads**.
- **Werbe-, Tracker- und Cookie-Banner-Blocker** (Brave Shields), Cookie-Banner werden nie bestätigt.
- **Weiterleitungs-Sperre** – schickt dich eine Seite ungefragt auf eine fremde Website,
  erscheint eine Sperrseite mit „Trotzdem öffnen“.
- **Mining-Erkennung** – CPU-Verbrauch pro Seite, Worker-Zähler, Warnung bei hoher Last.
  Dazu ist WebAssembly komplett aus (darüber laufen fast alle Browser-Miner).
- **Dashboard im neuen Tab**: deine aktuelle IP mit Anbieter und Ort (Warnung, wenn das VPN aus ist),
  Download- und Upload-Versuche, blockierte Weiterleitungen, Verbrauch pro Seite, Lesezeichen.
- **Aussehen** (Darstellung → Aussehen …, Cmd+Komma): Dashboard-Design (Auto/Hell/Dunkel), Schrift und
  Schriftgröße sowie die Brave-Größe (Tabs, Adresszeile und Seite zusammen). Gilt bis zum Beenden;
  „Für einstellungen.json kopieren“ erzeugt den Text, mit dem es bei jedem Start gilt.
  Hell/Dunkel lässt sich auch direkt im Dashboard umschalten (Auto/☀︎/☾). **Cmd+Plus/Minus/0** zoomt nur die Seite.
- **Scharfes Bild**: Skalierung folgt dem Bildschirm (Retina 2×, normaler Monitor 1×), auch beim Wechsel.
- **Fenster im Container bleibt fest** maximiert – Ziehen und Doppelklick auf die Tab-Leiste sind im Container gesperrt.
  Immer nur ein Brave-Fenster: herausgezogene Tabs und Strg+N landen als Tab im Hauptfenster, Inkognito ist aus.
- **Flüssiges Scrollen** mit Trackpad (pixelgenau) und Maus (Brave scrollt jede Raste weich).
- **Mauszeiger blendet aus** nach 10 s ohne Bewegung (kommt bei Bewegung sofort zurück).
- **VPN-Check beim Start**.
- **Labor-Modus** zum Herunterladen und Prüfen verdächtiger Dateien – ohne dass sie den Container verlassen.
- **Glasbox.app**: eigenes Fenster mit eigenem Icon (hell/dunkel/getönt, macOS wählt selbst).
  Beim Start Normal oder Labor wählen, beim Schließen „Beenden + alles löschen“ oder im Hintergrund weiterlaufen.
- **Wöchentliche Update-Frage** für Brave.

## Installation

1. [OrbStack](https://orbstack.dev) und die Xcode-Kommandozeilentools (`xcode-select --install`) installieren.
2. Repo klonen, in den Ordner wechseln.
3. `./baue-app.sh` – erzeugt **Glasbox.app** (kann im Ordner bleiben oder nach „Programme“).
4. Glasbox.app starten. Beim ersten Start wird das Brave-Image einmalig geladen (~1,2 GB),
   danach startet alles lokal in Sekunden.

Die App ist eigenständig: der Code steckt in der App, alle Daten liegen in
`~/Library/Application Support/Glasbox` (Einstellungen, Schlüssel, Fenster-Profil).
Deshalb braucht Glasbox **keinen Zugriff auf Schreibtisch, Dokumente oder Downloads**.
Die App startet Glasbox im Hintergrund und beendet sich sofort wieder.

Beim ersten Start erzeugt Glasbox einen **eigenen Signierschlüssel** für seine Erweiterung
(nur in Library, nie im Repo). Jede Installation hat dadurch eine andere Erweiterungs-ID –
nichts ist bei zwei Installationen gleich.

## Benutzung

```bash
./sb            # starten (oder Fenster öffnen, falls er schon läuft)
./sb labor      # Labor-Modus starten (siehe unten)
./sb stop       # beenden – alles im Container wird gelöscht
./sb update     # neue Brave-Version holen
./sb status     # läuft er? wie alt ist Brave?
./sb log        # Container-Log
```

**Glasbox.app** fragt beim Start: **Normal** oder **Labor**. Läuft Glasbox schon, öffnet sich direkt
das Fenster. Schließen (oder Cmd+Q) fragt: **Beenden + alles löschen** (Standard – braucht danach keine
Leistung mehr) oder **im Hintergrund weiterlaufen**. Hängt das Bild: **Cmd+R** verbindet neu.
Fragen (VPN, Updates) kommen als Dialog.

Im Terminal geht dasselbe mit `./sb` (der Repo-Ordner funktioniert an jedem Ort, `./sb` findet
seinen Pfad selbst; er nutzt dieselben Daten in Library wie die App).
Nach Code-Änderungen `./baue-app.sh` erneut ausführen und die App neu nach „Programme“ ziehen.

### Labor-Modus

`./sb labor` erlaubt Downloads und die Dateiauswahl – aber **nur im Container**. So kannst du
z. B. eine verdächtige Datei herunterladen und bei VirusTotal hochladen. Das Dashboard zeigt
groß „🧪 Labor-Modus“ und listet die heruntergeladenen Dateien. Kein Datei-Transfer zum Mac,
Zwischenablage nur Richtung Container. `./sb stop` löscht alles.
(Windows-Programme laufen im Linux-Container nicht, ein Terminal gibt es nicht.)

### Updates

Sicherheitsupdates für Brave kommen **nicht automatisch** – das Image bleibt lokal, damit der
Start schnell ist und nichts ungefragt geladen wird. Stattdessen fragt `./sb` einmal pro Woche:
„Nach neuer Brave-Version suchen?“. Bei Ja werden nur die geänderten Teile geladen (meist
100–300 MB) und das Image lokal neu gebaut. Danach einmal `./sb stop` und neu starten.
Jederzeit manuell: `./sb update`.

### Einstellungen

Beim ersten Start wird `~/Library/Application Support/Glasbox/einstellungen.json` aus
`einstellungen.beispiel.json` angelegt (bleibt lokal, nicht im Repo):

| Feld | Bedeutung |
|---|---|
| `lesezeichen` | feste Lesezeichen im neuen Tab (nur `http`/`https`) |
| `heim_provider` | Teil des Namens deines Internet-Anbieters → rote Warnung, wenn das VPN aus ist |
| `erlaubte_weiterleitungen` | Ziel-Domains, auf die ohne Rückfrage weitergeleitet werden darf |
| `cpu_warnung_prozent` | ab welchem Ø-Verbrauch eine Seite als „hoher Verbrauch“ markiert wird |
| `cpu_kerne`, `arbeitsspeicher_gb` | Obergrenze für den Container (schützt den Mac vor Minern) |
| `aussehen` | optional: `design` (`auto`/`hell`/`dunkel`), `schrift` (`system`/`serif`/`mono`/`schmal`), `schriftgroesse` (12–20), `brave_groesse` (75/88/100/112/125/150) – am einfachsten über Aussehen → „Für einstellungen.json kopieren“ |

### Was beim Beenden gelöscht wird

`Beenden` bzw. `./sb stop` löscht den Container **und** seinen Speicher (Verlauf, Cookies, Cache,
heruntergeladene Dateien). Übrig bleiben nur: das Brave-Image (das Programm, ohne Surf-Daten),
deine Einstellungen und das leere Fenster-Profil in Library.

## Wie es funktioniert

```
 Mac                                         OrbStack (Linux-VM)
┌──────────────────────────────┐            ┌───────────────────────────────────────────┐
│ Glasbox-Fenster              │  Bild +    │ Container „glasbox“ (frisch bei jedem Start)│
│ (eigenes Brave-Profil,       │◀─ Ton ─────│  Brave + Glasbox-Erweiterung               │
│  kann NUR 127.0.0.1:1111)    │── Maus/ ──▶│  Firewall: lokales Netz gesperrt          │
│                              │   Tasten   │  ──▶ Internet (über dein VPN)              │
└──────────────────────────────┘            └───────────────────────────────────────────┘
```

Das Fenster zeigt nur einen **Bildstream**. Der Code der Webseiten läuft ausschließlich im Container.

### Schutzschichten

1. **Linux-VM** (OrbStack, Apple Virtualization) – der Container läuft nicht direkt auf macOS.
2. **Container ohne Ordner vom Mac** – nur zwei Einstellungsdateien, schreibgeschützt.
3. **Port nur auf `127.0.0.1:1111`** – nur von diesem Mac erreichbar, nicht aus WLAN oder Internet
   (1111 statt 3000, damit es nicht mit Next & Co. kollidiert). Funktioniert mit und ohne VPN.
   Fremde Webseiten werden von der Oberfläche abgewiesen (Origin-Prüfung).
4. **Brave-Sandbox an** (im Basis-Image aus): Namespace + seccomp. Fehlt sie, startet Brave nicht.
5. **Container gehärtet**: fast alle Linux-Rechte entfernt, `no-new-privileges`, kein sudo, kein Terminal,
   Speicher-/CPU-/Prozess-Limit, ungenutzte Weiterleitungen im Webserver entfernt.
6. **Firewall im Container**: Router, NAS, der Mac, das OrbStack-Netz und alles im lokalen Netz sind gesperrt.
   Ohne aktive Firewall startet Brave nicht.
7. **Abgeriegeltes Fenster** (Glasbox.app, Apple WebKit): lädt ausschließlich `127.0.0.1:1111` –
   Inhaltsregeln sperren jede andere Anfrage (getestet: localhost-Apps, Router, Internet gesperrt).
   Speichert nichts (nicht-persistenter Speicher), keine Downloads, keine Dateiauswahl, keine Kamera,
   kein Mikrofon, keine Pop-ups, keine Verbindung von der Seite zur App.
   Im Terminal öffnet `./sb` stattdessen ein ebenso abgeriegeltes Brave-Fenster mit eigenem Profil.
   Darum **nie in einem normalen Browser-Tab öffnen**.
8. **Zwischenablage nur Mac → Container** und nur über das Feld in der Seitenleiste.
   Kein Datei-Transfer, keine Teilen-Links, kein Mikro, keine Kamera.
9. **Brave-Richtlinien** ([docker/policies.json](docker/policies.json)): Downloads und Dateiauswahl gesperrt,
   JavaScript-JIT aus (damit auch WebAssembly), WebGL aus, XSLT aus, PDFs werden nicht gerendert,
   Zugriff auf lokales Netz gesperrt, nur HTTPS, Zertifikatsfehler nicht übergehbar, WebRTC-IP-Leak-Schutz,
   keine Passwörter/Autofill, Cookies nur für die Sitzung, fremde Erweiterungen gesperrt.
10. **Brave Shields**: Werbe-/Tracker-Blocker, Cookie-Banner-Blocker, Miner-Listen.

### Grenzen

- JIT aus macht JavaScript-lastige Seiten langsamer; WebAssembly-Seiten (Spiele, manche Tools) gehen nicht.
- Brave und der Stream-Server laufen im Container als derselbe Nutzer. Bricht ein Angreifer aus Braves
  Sandbox aus, kontrolliert er auch den Stream – deshalb ist das Fenster am Mac abgeriegelt.
- Weiterleitungen werden erkannt, *nachdem* die Zielseite zu laden beginnt – ein paar Millisekunden Skript
  können dort laufen (im Container).
- CPU pro Seite ist eine Schätzung (gemessen wird der ganze Browser, während die Seite sichtbar ist).
- Kein VPN-Kill-Switch: fällt das VPN aus, geht der Verkehr über deine normale Leitung.
- Programme auf deinem Mac selbst können `127.0.0.1:1111` erreichen (aber nichts aus dem Netzwerk).

## Projektaufbau

| Pfad | Inhalt |
|---|---|
| `sb` | Startskript (auch in der App enthalten) |
| `baue-app.sh` | baut Glasbox.app (braucht nur `swiftc`) |
| `app/Glasbox.swift` | die App: Startfenster, abgeriegeltes Stream-Fenster, Beenden-Dialog |
| `docker/Dockerfile` | Image auf Basis von `lscr.io/linuxserver/brave` |
| `docker/policies.json` | Brave-Richtlinien (Vorlage, ID wird pro Klon eingesetzt) |
| `docker/vorbereiten.py` | Schlüssel erzeugen, Vorlagen füllen, Einstellungen prüfen, Build-Ordner in Library anlegen |
| `docker/firewall.sh`, `docker/wrapped-brave` | Firewall, Brave-Start mit Sandbox |
| `docker/seccomp-brave.json` | seccomp-Profil (aus `make-seccomp.py` + Docker-Standardprofil) |
| `extension/` | Glasbox-Erweiterung: Dashboard, Weiterleitungs- und Mining-Wächter |
| `icon/` | Icon (SVG), Icon-Composer-Paket, kompiliertes App-Icon, `baue-icons.sh` (braucht Xcode) |

## Mitmachen

Issues und Pull Requests sind willkommen – z. B. für eine Linux-Version.
Mit einem Pull Request erlaubst du Kontaa5, deinen Beitrag in Glasbox zu verwenden,
zu ändern und weiterzugeben (siehe [LICENSE](LICENSE)).

## Lizenz

Alle Rechte vorbehalten – siehe [LICENSE](LICENSE). Ansehen und Issues schreiben ist ausdrücklich erwünscht.
Brave, OrbStack und linuxserver.io gehören ihren jeweiligen Inhabern; Glasbox steht in keiner Verbindung zu ihnen.
