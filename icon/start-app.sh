#!/bin/bash
# Keepway.app: startet das mitgelieferte sb im Hintergrund und beendet sich sofort.
# So gilt die App nie als „hängend offen“ – jeder Klick startet frisch. Fragen kommen als Dialog.
CODE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../Resources/keepway" && pwd)"
DATEN="$HOME/Library/Application Support/Keepway"
mkdir -p "$DATEN"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
nohup "$CODE/sb" app </dev/null >>"$DATEN/app.log" 2>&1 &
exit 0
