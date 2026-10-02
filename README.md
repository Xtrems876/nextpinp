# Auto PiP Manager

**GNOME Shell extension** — automatically manages Picture-in-Picture windows and add MacOS like behaviour.

[Gnome Extenstions](https://extensions.gnome.org/extension/9827/auto-pip-manager/)

## Features

- Automatically pins PiP windows **above all other windows**
- Automatically makes PiP windows visible **on every workspace**
- Moves PiP windows to a **chosen corner** of the screen on appearance
- Snaps PiP windows to a nearest screen corner after a moving.
- No Top Bar icon, no background processes beyond a single window-creation listener

## Requirements

- GNOME Shell 45 or later

## Installation

```bash
git clone <repo-url>
cd NextPinP
./install.sh
gnome-extensions enable nextpinp@leonid.nasedkin
```

On **Wayland** a session restart (log out / log in) is required after the first install.  
On **X11** you can reload GNOME Shell in place: press `Alt+F2`, type `r`, press `Enter`.

## Settings

Open the preferences window via the **Extensions** app or:

```bash
gnome-extensions prefs nextpinp@leonid.nasedkin
```

| Setting | Description | Default |
|---------|-------------|---------|
| Corner | Screen corner where PiP windows are placed | Bottom Right |
| Offset | Distance from the corner edge in pixels (0–50) | 20 |

Available corners: Top Left, Top Right, Bottom Right, Bottom Left.

## Translations

PiP window titles are translated from Firefox language packs. To generate the
locale catalogs before installing, run:

```bash
./translate.sh
./install.sh
```

## Project structure

```
├── extension.js       Main extension logic
├── prefs.js           Preferences UI (libadwaita)
├── metadata.json      Extension metadata
├── translate.sh       Generate PiP title translations
├── schemas/           GSettings schema
└── install.sh         Build & install script
```

## License

GPL-2.0-or-later
