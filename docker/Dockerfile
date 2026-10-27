# Glasbox: Brave im Wegwerf-Container
# Build-Kontext = ~/Library/Application Support/Glasbox/build (von docker/vorbereiten.py
# mit der eigenen Erweiterungs-ID gefüllt). Baut immer auf der lokal vorhandenen Basis;
# neue Brave-Version nur über ./sb update bzw. die wöchentliche Nachfrage.
ARG BASE=lscr.io/linuxserver/brave:latest

# --- Stufe 1: Erweiterung signieren (der Schlüssel landet NICHT im fertigen Image) ---
FROM ${BASE} AS packer
COPY extension /tmp/pack/ext
COPY extension.pem /tmp/pack/key.pem
RUN /opt/brave.com/brave/brave --no-sandbox --headless \
      --pack-extension=/tmp/pack/ext --pack-extension-key=/tmp/pack/key.pem >/dev/null 2>&1 ; \
    test -s /tmp/pack/ext.crx

# --- Stufe 2: eigentliches Image ---
FROM ${BASE}
COPY policies.json /etc/brave/policies/managed/glasbox.json
COPY updates.xml /opt/sb-crx/updates.xml
COPY --from=packer /tmp/pack/ext.crx /opt/sb-crx/sb.crx
COPY wrapped-brave /usr/bin/wrapped-brave
COPY firewall.sh /custom-cont-init.d/10-firewall
COPY icon.png /usr/share/selkies/www/icon.png
COPY labwc.xml /defaults/labwc.xml
COPY fenster-waechter.py /usr/local/bin/glasbox-fenster
COPY glasbox.gschema.override /usr/share/glib-2.0/schemas/90_glasbox.gschema.override

# nginx: ungenutzte Weiterleitungen (/devmode -> :5173, /pelorus/ -> :5100) entfernen –
# sonst könnte ein kompromittierter Prozess dort lauschen und Seiten unter der Zuschauer-Adresse ausliefern.
# Nur Host 127.0.0.1 annehmen: Seiten im normalen Browser am Mac kommen per DNS-Rebinding
# (fremder Name -> 127.0.0.1) so nicht einmal an die Oberfläche.
RUN sed -i -e '/location \/devmode {/,/^  }/d' -e '/location SUBFOLDERpelorus\/ {/,/^  }/d' /defaults/default.conf \
 && ! grep -qE 'devmode|pelorus|5173|5100' /defaults/default.conf \
 && sed -i -E 's/^(  listen \[::\]:300[01].*)$/\1\n  if ($host != "127.0.0.1") { return 403; }/' /defaults/default.conf \
 && test "$(grep -c 'return 403' /defaults/default.conf)" = 2

# chrome-sandbox ohne setuid: Brave nutzt die Namespace-Sandbox (seccomp-brave.json).
# Klappt die nicht, startet Brave gar nicht, statt still ohne Sandbox zu laufen.
RUN chmod 0755 /opt/brave.com/brave/chrome-sandbox \
 && chmod 0755 /usr/bin/wrapped-brave /custom-cont-init.d/10-firewall /usr/local/bin/glasbox-fenster \
 && chmod 0644 /usr/share/selkies/www/icon.png /defaults/labwc.xml /usr/share/glib-2.0/schemas/90_glasbox.gschema.override \
 && glib-compile-schemas /usr/share/glib-2.0/schemas \
 && chmod -R a+rX,go-w /opt/sb-crx /etc/brave
