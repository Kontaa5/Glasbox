// Keepway.app – eigenes Fenster für den Wegwerf-Browser.
//
// Die App selbst surft nicht: sie startet über das mitgelieferte `sb` den Container und zeigt
// dessen Bildstream (http://127.0.0.1:1111) in einem abgeriegelten WKWebView:
//   - lädt ausschließlich 127.0.0.1:1111 (Navigation + Inhaltsregeln für jede Anfrage)
//   - speichert nichts (nicht-persistenter Datenspeicher), keine Downloads, keine Dateiauswahl,
//     keine Kamera/Mikrofon, keine neuen Fenster, keine Brücke von JavaScript zur App
// Beim Schließen: Keepway beenden + alles löschen (Standard) oder im Hintergrund weiterlaufen lassen.
import AppKit
import WebKit

let adresse = URL(string: "http://127.0.0.1:1111/")!
let erlaubterUrsprung = "http://127.0.0.1:1111"

// MARK: - sb aufrufen (Argument-Array, kein Shell-String)

enum Sb {
    static var pfad: String { Bundle.main.resourcePath! + "/keepway/sb" }

    /// Führt `sb <args>` aus und liefert (Exit-Code, Ausgabe). Ausgabe geht zusätzlich ins Log.
    static func ausfuehren(_ args: [String]) -> (Int32, String) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/bash")
        p.arguments = [pfad] + args
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        p.environment = env
        p.standardInput = FileHandle.nullDevice
        let rohr = Pipe()
        p.standardOutput = rohr
        p.standardError = rohr
        do { try p.run() } catch { return (127, "sb konnte nicht gestartet werden: \(error.localizedDescription)") }
        let daten = rohr.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        let text = String(decoding: daten, as: UTF8.self)
        protokolliere(text)
        return (p.terminationStatus, text)
    }

    static func protokolliere(_ text: String) {
        let ordner = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Keepway", isDirectory: true)
        try? FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
        let datei = ordner.appendingPathComponent("app.log")
        if let h = try? FileHandle(forWritingTo: datei) {
            h.seekToEndOfFile(); h.write(Data(text.utf8)); try? h.close()
        } else {
            try? Data(text.utf8).write(to: datei)
        }
    }

    /// Letzte sinnvolle Zeile (ohne Farbcodes) für Fehlermeldungen.
    static func letzteZeile(_ text: String) -> String {
        let ohneFarben = text.replacingOccurrences(of: "\u{1B}\\[[0-9;]*m", with: "", options: .regularExpression)
        return ohneFarben.split(separator: "\n").last.map(String.init) ?? "Unbekannter Fehler"
    }
}

// MARK: - Startfenster (Modus wählen)

final class StartController: NSWindowController {
    var gewaehlt: ((String) -> Void)?
    private let status = NSTextField(labelWithString: "")
    private let rad = NSProgressIndicator()
    private var knoepfe: [NSButton] = []

    convenience init() {
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 440, height: 300),
                         styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "Keepway"
        self.init(window: w)
        baue()
        w.center()
    }

    private func baue() {
        let icon = NSImageView(image: NSApp.applicationIconImage)
        icon.imageScaling = .scaleProportionallyUpOrDown
        let titel = NSTextField(labelWithString: "Wie soll Keepway starten?")
        titel.font = .systemFont(ofSize: 17, weight: .semibold)
        let info = NSTextField(wrappingLabelWithString:
            "Normal: Downloads und Uploads gesperrt.\nLabor: Downloads erlaubt – sie bleiben im Container und werden beim Beenden gelöscht.")
        info.textColor = .secondaryLabelColor
        let normal = NSButton(title: "Normal", target: self, action: #selector(normalGewaehlt))
        normal.keyEquivalent = "\r"
        let labor = NSButton(title: "🧪 Labor", target: self, action: #selector(laborGewaehlt))
        knoepfe = [normal, labor]
        rad.style = .spinning; rad.controlSize = .small; rad.isDisplayedWhenStopped = false
        status.textColor = .secondaryLabelColor

        let knopfReihe = NSStackView(views: [labor, normal]); knopfReihe.spacing = 12
        let statusReihe = NSStackView(views: [rad, status]); statusReihe.spacing = 8
        let stapel = NSStackView(views: [icon, titel, info, knopfReihe, statusReihe])
        stapel.orientation = .vertical; stapel.alignment = .centerX; stapel.spacing = 14
        stapel.edgeInsets = NSEdgeInsets(top: 24, left: 28, bottom: 24, right: 28)
        icon.widthAnchor.constraint(equalToConstant: 72).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 72).isActive = true
        info.preferredMaxLayoutWidth = 380
        window?.contentView = stapel
    }

    @objc private func normalGewaehlt() { waehle("normal") }
    @objc private func laborGewaehlt() { waehle("labor") }

    private func waehle(_ modus: String) {
        knoepfe.forEach { $0.isEnabled = false }
        zeige("Startet … (beim ersten Mal kann es länger dauern)")
        gewaehlt?(modus)
    }

    func zeige(_ text: String, laeuft: Bool = true) {
        status.stringValue = text
        laeuft ? rad.startAnimation(nil) : rad.stopAnimation(nil)
    }

    func fehler(_ text: String) {
        zeige(text, laeuft: false)
        status.textColor = .systemRed
        knoepfe.forEach { $0.isEnabled = true }
    }
}

// MARK: - Stream-Fenster (abgeriegelter WKWebView)

final class StreamController: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var schliessenGewuenscht: (() -> Void)?
    private(set) var webView: WKWebView!

    convenience init(modus: String, regeln: WKContentRuleList?) {
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                         styleMask: [.titled, .closable, .miniaturizable, .resizable],
                         backing: .buffered, defer: false)
        w.title = modus == "labor" ? "Keepway – 🧪 Labor" : "Keepway"
        w.setFrameAutosaveName("KeepwayStream")
        w.collectionBehavior = [.fullScreenPrimary]
        self.init(window: w)
        w.delegate = self

        let c = WKWebViewConfiguration()
        c.websiteDataStore = .nonPersistent()          // nichts auf die Platte
        c.mediaTypesRequiringUserActionForPlayback = []  // Ton des Streams ohne Extra-Klick
        if let regeln { c.userContentController.add(regeln) }
        webView = WKWebView(frame: .zero, configuration: c)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = false
        w.contentView = webView
        if !w.setFrameUsingName("KeepwayStream") { w.center() }
        webView.load(URLRequest(url: adresse))
    }

    // Nur die Keepway-Oberfläche darf geladen werden.
    func webView(_ v: WKWebView, decidePolicyFor a: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let u = a.request.url
        let ok = u?.scheme == "http" && u?.host == "127.0.0.1" && u?.port == 1111
        decisionHandler(ok ? .allow : .cancel)
    }

    // Keine Downloads: was nicht direkt angezeigt werden kann, wird verworfen.
    func webView(_ v: WKWebView, decidePolicyFor r: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(r.canShowMIMEType ? .allow : .cancel)
    }

    // Keine neuen Fenster/Pop-ups.
    func webView(_ v: WKWebView, createWebViewWith c: WKWebViewConfiguration,
                 for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? { nil }

    // Keine Kamera, kein Mikrofon.
    func webView(_ v: WKWebView, requestMediaCapturePermissionFor o: WKSecurityOrigin,
                 initiatedByFrame f: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }

    // Keine Dateiauswahl vom Mac.
    func webView(_ v: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
                 completionHandler: @escaping ([URL]?) -> Void) { completionHandler(nil) }

    // Absturz des Web-Prozesses: einfach neu laden.
    func webViewWebContentProcessDidTerminate(_ v: WKWebView) { v.load(URLRequest(url: adresse)) }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        schliessenGewuenscht?()
        return false
    }

    @objc func neuLaden(_ sender: Any?) { webView.load(URLRequest(url: adresse)) }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var start: StartController?
    private var stream: StreamController?
    private var regeln: WKContentRuleList?
    private var beendetSich = false

    func applicationDidFinishLaunching(_ n: Notification) {
        baueMenue()
        // Inhaltsregeln: jede Anfrage (Seiten, Skripte, fetch, WebSocket …) außer 127.0.0.1:1111 blockieren.
        let json = """
        [{"trigger":{"url-filter":".*"},"action":{"type":"block"}},
         {"trigger":{"url-filter":"^http://127\\\\.0\\\\.0\\\\.1:1111/"},"action":{"type":"ignore-previous-rules"}},
         {"trigger":{"url-filter":"^ws://127\\\\.0\\\\.0\\\\.1:1111/"},"action":{"type":"ignore-previous-rules"}}]
        """
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "keepway-nur-lokal",
                                                                encodedContentRuleList: json) { liste, fehler in
            if liste == nil {
                // Ohne Regeln kein Fenster – lieber gar nicht als ungeschützt.
                self.meldeUndBeende("Keepway konnte seine Schutzregeln nicht laden: \(fehler?.localizedDescription ?? "?")")
                return
            }
            self.regeln = liste
            self.pruefeZustand()
        }
    }

    private func pruefeZustand() {
        DispatchQueue.global().async {
            let (_, aus) = Sb.ausfuehren(["modus"])
            let modus = aus.trimmingCharacters(in: .whitespacesAndNewlines)
            DispatchQueue.main.async {
                if modus == "normal" || modus == "labor" { self.zeigeStream(modus) } else { self.zeigeStart() }
            }
        }
    }

    private func zeigeStart() {
        let s = StartController()
        s.gewaehlt = { [weak self, weak s] modus in
            DispatchQueue.global().async {
                let (code, aus) = Sb.ausfuehren(["hochfahren", modus])
                DispatchQueue.main.async {
                    if code == 0 {
                        s?.close(); self?.start = nil
                        self?.zeigeStream(modus)
                    } else {
                        s?.fehler(Sb.letzteZeile(aus))
                    }
                }
            }
        }
        start = s
        s.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func zeigeStream(_ modus: String) {
        let s = StreamController(modus: modus, regeln: regeln)
        s.schliessenGewuenscht = { [weak self] in self?.frageBeenden() }
        stream = s
        s.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    /// Schließen oder Cmd+Q: beenden + löschen (Standard) oder im Hintergrund laufen lassen.
    private func frageBeenden() {
        let a = NSAlert()
        a.messageText = "Keepway beenden?"
        a.informativeText = "Beim Beenden wird alles im Container gelöscht – Verlauf, Cookies, Dateien – und er braucht keine Leistung mehr."
        a.addButton(withTitle: "Beenden + alles löschen")
        a.addButton(withTitle: "Im Hintergrund weiterlaufen")
        a.addButton(withTitle: "Abbrechen")
        switch a.runModal() {
        case .alertFirstButtonReturn: beendeKeepway()
        case .alertSecondButtonReturn: beendetSich = true; NSApp.terminate(nil)
        default: break
        }
    }

    private func beendeKeepway() {
        stream?.window?.title = "Keepway – wird beendet …"
        stream?.webView.loadHTMLString("<body style='background:#0f1115;color:#8b92a0;font:15px system-ui;display:grid;place-items:center;height:90vh'>Keepway wird beendet und gelöscht …</body>", baseURL: nil)
        DispatchQueue.global().async {
            _ = Sb.ausfuehren(["stop"])
            DispatchQueue.main.async { self.beendetSich = true; NSApp.terminate(nil) }
        }
    }

    func applicationShouldTerminate(_ s: NSApplication) -> NSApplication.TerminateReply {
        if beendetSich || stream == nil { return .terminateNow }
        frageBeenden()
        return .terminateCancel
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { stream == nil }

    func applicationShouldHandleReopen(_ s: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows { (stream?.window ?? start?.window)?.makeKeyAndOrderFront(nil) }
        return true
    }

    private func meldeUndBeende(_ text: String) {
        let a = NSAlert(); a.messageText = "Keepway"; a.informativeText = text; a.runModal()
        beendetSich = true; NSApp.terminate(nil)
    }

    private func baueMenue() {
        let haupt = NSMenu()
        let appItem = NSMenuItem(); haupt.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Keepway ausblenden", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Keepway beenden …", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let bearbItem = NSMenuItem(); haupt.addItem(bearbItem)
        let bearb = NSMenu(title: "Bearbeiten")
        bearb.addItem(withTitle: "Kopieren", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        bearb.addItem(withTitle: "Einfügen", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        bearb.addItem(withTitle: "Alles auswählen", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        bearbItem.submenu = bearb

        let ansichtItem = NSMenuItem(); haupt.addItem(ansichtItem)
        let ansicht = NSMenu(title: "Darstellung")
        ansicht.addItem(withTitle: "Neu verbinden", action: #selector(StreamController.neuLaden(_:)), keyEquivalent: "r")
        let voll = ansicht.addItem(withTitle: "Vollbild", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        voll.keyEquivalentModifierMask = [.command, .control]
        ansichtItem.submenu = ansicht

        let fensterItem = NSMenuItem(); haupt.addItem(fensterItem)
        let fenster = NSMenu(title: "Fenster")
        fenster.addItem(withTitle: "Minimieren", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        fenster.addItem(withTitle: "Schließen", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fensterItem.submenu = fenster
        NSApp.windowsMenu = fenster
        NSApp.mainMenu = haupt
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
