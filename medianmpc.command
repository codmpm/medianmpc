#!/bin/bash
#
# medianmpc starten (macOS)
#
# Doppelklick im Finder startet die App aus diesem Ordner; der Dev-Server öffnet
# sie im Browser. Voraussetzung: Node.js und einmal "npm ci" in diesem Ordner.
#
# Beenden: dieses Terminal-Fenster schließen oder Ctrl+C drücken.

URL="http://localhost:8080/medianmpc/"

# Ein Doppelklick startet ohne die PATH-Einstellungen der Shell
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh" >/dev/null
fi

fail() {
    echo
    echo "FEHLER: $*"
    echo
    read -r -p "Enter drücken zum Schließen ..." _
    exit 1
}

# readlink -f folgt einem Symlink (z. B. auf dem Schreibtisch) bis zum Repo-Ordner
cd "$(dirname "$(readlink -f "$0")")" || fail "Kann nicht in den Ordner des Skripts wechseln."

# Läuft die App schon? Dann nur den Browser öffnen
if curl -fs -o /dev/null "$URL"; then
    open "$URL"
    exit 0
fi

command -v npm >/dev/null 2>&1 || fail "Node.js ist nicht installiert (https://nodejs.org)."
[ -d node_modules ] || fail "Abhängigkeiten fehlen. Bitte einmal im Terminal in diesem Ordner \"npm ci\" ausführen."

echo "Starte medianmpc unter $URL"
echo "Zum Beenden dieses Fenster schließen oder Ctrl+C drücken."
echo
npm run dev || fail "Die App konnte nicht gestartet werden."
