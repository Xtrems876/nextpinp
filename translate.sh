#!/bin/sh

TRANSLATIONS_PATH="pub/firefox/releases/144.0/linux-x86_64/xpi/"
TRANSLATIONS_URI="https://ftp.mozilla.org/$TRANSLATIONS_PATH"
LANG_PACKS=$(curl -s "$TRANSLATIONS_URI" | grep -Po "(?<=$TRANSLATIONS_PATH).*?(?=\.xpi)")
TEMP_FILE="/tmp/nextpinp-firefox-lang"
BOT_DATE=$(date "+%F %H:%M+0000")
GETTEXT="nextpinp"

compile_mo_file() {
  MO_PATH="locale/$LANG/LC_MESSAGES"
  mkdir -p "$MO_PATH"
  msgfmt -o "$MO_PATH/$GETTEXT.mo" "po/$LANG.po"
}

create_po_file() {
  cat > "po/$LANG.po" <<EOF
# Generated from the Firefox PiP language pack.
msgid ""
msgstr ""
"Project-Id-Version: nextpinp@leonid.nasedkin\\n"
"PO-Revision-Date: $BOT_DATE\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Language: $LANG\\n"

msgid "Picture-in-Picture"
msgstr "$PIP_NAME"
EOF

  compile_mo_file
}

mkdir -p po

while IFS= read -r LINE; do
  LANG=$(echo "$LINE" | tr "-" "_")
  echo "Downloading language: $LANG"
  curl -fsSL "$TRANSLATIONS_URI$LINE.xpi" -o "$TEMP_FILE"
  PIP_NAME=$(unzip -p "$TEMP_FILE" "localization/$LINE/toolkit/pictureinpicture/pictureinpicture.ftl" \
    | sed -n -e 's/^.*pictureinpicture-player-title = //p')
  echo "Translation $LANG: $PIP_NAME"
  create_po_file
done <<EOF
$LANG_PACKS
EOF

rm -f "$TEMP_FILE"
echo "Translations generated in po/ and locale/"