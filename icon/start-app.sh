#!/bin/bash
# Keepway.app: startet das mitgelieferte sb ohne Terminal (Fragen kommen als Dialog).
CODE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../Resources/keepway" && pwd)"
DATEN="$HOME/Library/Application Support/Keepway"
mkdir -p "$DATEN"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
exec "$CODE/sb" app >>"$DATEN/app.log" 2>&1
