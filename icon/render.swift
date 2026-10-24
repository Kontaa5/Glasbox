// Rendert ein SVG als PNG in fester Größe (nutzt die SVG-Unterstützung von AppKit).
// Aufruf: swift render.swift <eingabe.svg> <ausgabe.png> <pixel>
import AppKit
let a = CommandLine.arguments
guard a.count == 4, let px = Int(a[3]), let bild = NSImage(contentsOfFile: a[1]) else {
    FileHandle.standardError.write("Aufruf: render.swift in.svg out.png pixel\n".data(using: .utf8)!); exit(1)
}
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high
bild.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
