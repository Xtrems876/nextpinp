import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const CORNER_VALUES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

export default class AutoPiPPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        // — Behaviour group —
        const behaviourGroup = new Adw.PreferencesGroup({ title: 'Behaviour' });
        page.add(behaviourGroup);

        const alwaysOnTopRow = new Adw.SwitchRow({
            title: 'Always on Top',
            subtitle: 'Keep PiP window above all other windows',
            active: settings.get_boolean('always-on-top'),
        });
        alwaysOnTopRow.connect('notify::active', () => {
            settings.set_boolean('always-on-top', alwaysOnTopRow.active);
        });
        behaviourGroup.add(alwaysOnTopRow);

        const alwaysOnAllWorkspacesRow = new Adw.SwitchRow({
            title: 'Always Visible on All Workspaces',
            subtitle: 'Show PiP window on every workspace',
            active: settings.get_boolean('always-on-all-workspaces'),
        });
        alwaysOnAllWorkspacesRow.connect('notify::active', () => {
            settings.set_boolean('always-on-all-workspaces', alwaysOnAllWorkspacesRow.active);
        });
        behaviourGroup.add(alwaysOnAllWorkspacesRow);

        // — Window Position group —
        const positionGroup = new Adw.PreferencesGroup({ title: 'Window Position' });
        page.add(positionGroup);

        const cornerRow = new Adw.ComboRow({
            title: 'Corner',
            model: new Gtk.StringList({
                strings: [
                    'Top Left',
                    'Top Right',
                    'Bottom Right',
                    'Bottom Left',
                ],
            }),
        });
        const currentCorner = settings.get_string('corner');
        cornerRow.selected = Math.max(0, CORNER_VALUES.indexOf(currentCorner));
        cornerRow.connect('notify::selected', () => {
            settings.set_string('corner', CORNER_VALUES[cornerRow.selected]);
        });
        positionGroup.add(cornerRow);

        const offsetRow = new Adw.SpinRow({
            title: 'Offset',
            subtitle: 'Distance from the screen corner in pixels',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 50,
                step_increment: 1,
                value: settings.get_int('offset'),
            }),
        });
        offsetRow.connect('notify::value', () => {
            settings.set_int('offset', offsetRow.value);
        });
        positionGroup.add(offsetRow);

        window.add(page);
    }
}
