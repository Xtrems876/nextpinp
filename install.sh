#!/usr/bin/env bash
set -euo pipefail

UUID="nextpinp@leonid.nasedkin"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST/schemas"
cp metadata.json extension.js prefs.js "$DEST/"
cp schemas/*.xml "$DEST/schemas/"
glib-compile-schemas "$DEST/schemas/"

if compgen -G "po/*.po" > /dev/null; then
	for po_file in po/*.po; do
		lang=$(basename "$po_file" .po)
		mkdir -p "$DEST/locale/$lang/LC_MESSAGES"
		msgfmt "$po_file" -o "$DEST/locale/$lang/LC_MESSAGES/nextpinp.mo"
		echo "Compiled locale: $lang"
	done
fi

echo ""
echo "Installed to $DEST"
echo ""
echo "Enable with:"
echo "  gnome-extensions enable $UUID"
echo ""
echo "Open settings with:"
echo "  gnome-extensions prefs $UUID"
