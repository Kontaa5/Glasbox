# Keepway: Brave im Wegwerf-Container
# Build-Kontext = Projektordner. Dateien kommen aus .laufzeit/build/ (von docker/vorbereiten.py
# mit der eigenen Erweiterungs-ID gefüllt). Baut immer auf der lokal vorhandenen Basis;
# neue Brave-Version nur über ./sb update bzw. die wöchentliche Nachfrage.
ARG BASE=lscr.io/linuxserver/brave:latest

# --- Stufe 1: Erweiterung signieren (der Schlüssel landet NICHT im fertigen Image) ---
FROM ${BASE} AS packer
COPY .laufzeit/build/extension /tmp/pack/ext
COPY .laufzeit/build/extension.pem /tmp/pack/key.pem
RUN /opt/brave.com/brave/brave --no-sandbox --headless \
      --pack-extension=/tmp/pack/ext --pack-extension-key=/tmp/pack/key.pem >/dev/null 2>&1 ; \
    test -s /tmp/pack/ext.crx

# --- Stufe 2: eigentliches Image ---
FROM ${BASE}
COPY .laufzeit/build/policies.json /etc/brave/policies/managed/keepway.json
COPY .laufzeit/build/updates.xml /opt/sb-crx/updates.xml
COPY --from=packer /tmp/pack/ext.crx /opt/sb-crx/sb.crx
COPY docker/wrapped-brave /usr/bin/wrapped-brave
COPY docker/firewall.sh /custom-cont-init.d/10-firewall
COPY icon/keepway-512.png /usr/share/selkies/www/icon.png

# nginx: ungenutzte Weiterleitungen (/devmode -> :5173, /pelorus/ -> :5100) entfernen –
# sonst könnte ein kompromittierter Prozess dort lauschen und Seiten unter der Zuschauer-Adresse ausliefern.
RUN sed -i -e '/location \/devmode {/,/^  }/d' -e '/location SUBFOLDERpelorus\/ {/,/^  }/d' /defaults/default.conf \
 && ! grep -qE 'devmode|pelorus|5173|5100' /defaults/default.conf

# chrome-sandbox ohne setuid: Brave nutzt die Namespace-Sandbox (seccomp-brave.json).
# Klappt die nicht, startet Brave gar nicht, statt still ohne Sandbox zu laufen.
RUN chmod 0755 /opt/brave.com/brave/chrome-sandbox \
 && chmod 0755 /usr/bin/wrapped-brave /custom-cont-init.d/10-firewall \
 && chmod 0644 /usr/share/selkies/www/icon.png \
 && chmod -R a+rX,go-w /opt/sb-crx /etc/brave
