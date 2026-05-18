import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const PIP_TITLES = [
    'picture-in-picture',
    'picture in picture',
    'pictureinpicture',
    'pinp',
];

function isPiP(window) {
    if (!window)
        return false;
    if (window.get_window_type() !== Meta.WindowType.NORMAL)
        return false;

    const title = (window.get_title() ?? '').toLowerCase();
    if (title && PIP_TITLES.some(t => title === t))
        return true;

    const wmClass = window.get_wm_class() ?? '';
    const wmClassInstance = window.get_wm_class_instance() ?? '';
    if (title && /picture.?in.?picture/i.test(title))
        return true;
    if (wmClass && /picture.?in.?picture/i.test(wmClass))
        return true;
    if (wmClassInstance && /picture.?in.?picture/i.test(wmClassInstance))
        return true;

    return false;
}

function applyPiPAttributes(window, settings) {
    if (settings.get_boolean('always-on-all-workspaces'))
        window.stick();
    if (settings.get_boolean('always-on-top'))
        window.make_above();
}

// Returns the corner key and target {x, y} for the given corner + offset.
function cornerPosition(corner, offset, workArea, frameRect) {
    switch (corner) {
        case 'top-left':
            return { x: workArea.x + offset, y: workArea.y + offset };
        case 'top-right':
            return {
                x: workArea.x + workArea.width - frameRect.width - offset,
                y: workArea.y + offset,
            };
        case 'bottom-left':
            return {
                x: workArea.x + offset,
                y: workArea.y + workArea.height - frameRect.height - offset,
            };
        case 'bottom-right':
        default:
            return {
                x: workArea.x + workArea.width - frameRect.width - offset,
                y: workArea.y + workArea.height - frameRect.height - offset,
            };
    }
}

function moveToPiPCorner(window, settings) {
    const workArea = window.get_work_area_current_monitor();
    const frameRect = window.get_frame_rect();

    if (!frameRect.width || !frameRect.height)
        return false;

    const { x, y } = cornerPosition(
        settings.get_string('corner'),
        settings.get_int('offset'),
        workArea, frameRect
    );
    window.move_frame(true, x, y);
    return true;
}

// Snap to the nearest corner after a drag, then persist the new corner in settings.
function snapToNearestCorner(window, settings) {
    const workArea = window.get_work_area_current_monitor();
    const frameRect = window.get_frame_rect();
    const offset = settings.get_int('offset');

    // Use window centre to decide which quadrant it's in.
    const cx = frameRect.x + frameRect.width / 2;
    const cy = frameRect.y + frameRect.height / 2;
    const onLeft = cx < workArea.x + workArea.width / 2;
    const onTop  = cy < workArea.y + workArea.height / 2;

    const corner =
        onLeft && onTop  ? 'top-left'    :
        !onLeft && onTop ? 'top-right'   :
        onLeft           ? 'bottom-left' : 'bottom-right';

    const { x, y } = cornerPosition(corner, offset, workArea, frameRect);
    window.move_frame(true, x, y);

    // Persist so the next PiP window opens in the same corner.
    settings.set_string('corner', corner);
}

export default class AutoPiPManager extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._pendingIdles = new Set();

        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._pendingIdles.delete(id);

                if (!isPiP(window))
                    return GLib.SOURCE_REMOVE;

                applyPiPAttributes(window, this._settings);

                if (!moveToPiPCorner(window, this._settings)) {
                    const actor = window.get_compositor_private();
                    if (actor) {
                        const frameId = actor.connect('first-frame', () => {
                            actor.disconnect(frameId);
                            moveToPiPCorner(window, this._settings);
                        });
                    }
                }

                return GLib.SOURCE_REMOVE;
            });
            this._pendingIdles.add(id);
        });

        // Snap to nearest corner when a PiP window drag ends.
        this._grabOpEndId = global.display.connect('grab-op-end', (_display, window, op) => {
            if (!window)
                return;
            if (op !== Meta.GrabOp.MOVING && op !== Meta.GrabOp.KEYBOARD_MOVING)
                return;
            if (!isPiP(window))
                return;
            snapToNearestCorner(window, this._settings);
        });
    }

    disable() {
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._grabOpEndId) {
            global.display.disconnect(this._grabOpEndId);
            this._grabOpEndId = null;
        }

        for (const id of this._pendingIdles)
            GLib.source_remove(id);
        this._pendingIdles = null;

        this._settings = null;
    }
}
