#!/bin/bash
# Keepway.app: startet ./sb ohne Terminal (Fragen kommen als Dialog).
# Die App muss im Keepway-Ordner bleiben – ins Dock ziehen geht, nach /Programme kopieren nicht.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
mkdir -p "$ROOT/.laufzeit"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
exec "$ROOT/sb" app >>"$ROOT/.laufzeit/app.log" 2>&1
