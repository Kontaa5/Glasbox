#!/usr/bin/with-contenv bash
# Sperrt aus dem Container alle Ziele im lokalen Netz (Router, NAS, der Mac selbst).
# Erlaubt: Internet, DNS-Server des Containers, Antworten auf eingehende Verbindungen (Bildstream).
# Fail-closed: Nur wenn alles klappt, wird /run/sb-firewall-ok angelegt – ohne die Datei startet Brave nicht.
set -euo pipefail
rm -f /run/sb-firewall-ok

PRIVATE_V4="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16 0.0.0.0/8 224.0.0.0/4 240.0.0.0/4"
PRIVATE_V6="fc00::/7 fe80::/10 ff00::/8"
DNS_SERVERS=$(awk '/^nameserver/ {print $2}' /etc/resolv.conf)

iptables -F OUTPUT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for dns in $DNS_SERVERS; do
  if [[ "$dns" == *.* ]]; then
    iptables -A OUTPUT -d "$dns" -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -d "$dns" -p tcp --dport 53 -j ACCEPT
  fi
done
for net in $PRIVATE_V4; do
  iptables -A OUTPUT -d "$net" -j REJECT
done

if ip6tables -L OUTPUT >/dev/null 2>&1; then
  ip6tables -F OUTPUT
  ip6tables -A OUTPUT -o lo -j ACCEPT
  ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  for net in $PRIVATE_V6; do
    ip6tables -A OUTPUT -d "$net" -j REJECT
  done
elif [ -n "$(ip -6 addr show scope global 2>/dev/null)" ]; then
  echo "[Keepway] IPv6 vorhanden, aber ip6tables nicht nutzbar – Abbruch" >&2
  exit 1
fi

touch /run/sb-firewall-ok
echo "[Keepway] Firewall aktiv: lokales Netz gesperrt"
