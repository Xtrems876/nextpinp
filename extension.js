import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

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
    const normalizedTitle = title.replace(/[^a-z0-9]+/g, '');
    if (title && PIP_TITLES.some(t => title === t || normalizedTitle === t.replace(/[^a-z0-9]+/g, '')))
        return true;

    const wmClass = window.get_wm_class() ?? '';
    const wmClassInstance = window.get_wm_class_instance() ?? '';
    if (title && title === _('Picture-in-Picture').toLowerCase())
        return true;
    if (wmClass && /picture.?in.?picture/i.test(wmClass))
        return true;
    if (wmClassInstance && /picture.?in.?picture/i.test(wmClassInstance))
        return true;

    return false;
}

function managePiPWindow(window, settings) {
    const pipWindow = isPiP(window);

    if (!pipWindow) {
        if (window._nextPinPManaged) {
            restorePiPAttributes(window);
            window._nextPinPManaged = false;
        }
        return false;
    }

    const wasManaged = window._nextPinPManaged === true;
    if (!wasManaged) {
        window._nextPinPOriginalAbove = window.is_above();
        window._nextPinPOriginalSticky = window.is_on_all_workspaces();
    }
    window._nextPinPManaged = true;
    applyPiPAttributes(window, settings);

    if (!wasManaged && !moveToPiPCorner(window, settings)) {
        const actor = window.get_compositor_private();
        if (actor) {
            const frameId = actor.connect('first-frame', () => {
                actor.disconnect(frameId);
                moveToPiPCorner(window, settings);
            });
        }
    }

    return true;
}

function applyPiPAttributes(window, settings) {
    if (settings.get_boolean('always-on-all-workspaces') || window._nextPinPOriginalSticky) {
        window.stick();
    } else {
        window.unstick();
    }

    if (settings.get_boolean('always-on-top') || window._nextPinPOriginalAbove) {
        window.make_above();
    } else {
        window.unmake_above();
    }
}

function restorePiPAttributes(window) {
    if (window._nextPinPOriginalAbove)
        window.make_above();
    else
        window.unmake_above();

    if (window._nextPinPOriginalSticky)
        window.stick();
    else
        window.unstick();

    delete window._nextPinPOriginalAbove;
    delete window._nextPinPOriginalSticky;
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

        this._settingsChangedId = this._settings.connect('changed', () => {
            for (const actor of global.get_window_actors()) {
                const window = actor.meta_window;
                if (!window)
                    continue;

                if (managePiPWindow(window, this._settings))
                    moveToPiPCorner(window, this._settings);
            }
        });

        this._trackWindow = window => {
            if (!window)
                return;

            window._nextPinPTracked = true;
            window._nextPinPTitleChangedId = window.connect('notify::title', () => {
                managePiPWindow(window, this._settings);
            });
            managePiPWindow(window, this._settings);
        };

        this._untrackWindow = window => {
            if (!window)
                return;

            window._nextPinPTracked = false;
            if (window._nextPinPTitleChangedId) {
                window.disconnect(window._nextPinPTitleChangedId);
                window._nextPinPTitleChangedId = null;
            }
            if (window._nextPinPManaged) {
                restorePiPAttributes(window);
                window._nextPinPManaged = false;
            }
        };

        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            this._trackWindow(window);

            const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._pendingIdles.delete(id);

                if (!window._nextPinPTracked)
                    return GLib.SOURCE_REMOVE;

                managePiPWindow(window, this._settings);

                return GLib.SOURCE_REMOVE;
            });
            this._pendingIdles.add(id);
        });

        for (const actor of global.get_window_actors()) {
            const window = actor.meta_window;
            this._trackWindow(window);
        }

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

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        for (const id of this._pendingIdles)
            GLib.source_remove(id);
        this._pendingIdles = null;

        for (const actor of global.get_window_actors()) {
            const window = actor.meta_window;
            if (!window)
                continue;

            this._untrackWindow(window);
        }

        this._trackWindow = null;
        this._untrackWindow = null;
        this._settings = null;
    }
}
