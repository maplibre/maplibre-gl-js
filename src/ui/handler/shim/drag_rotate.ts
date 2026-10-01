import type {MousePitchHandler, MouseRollHandler, MouseRotateHandler} from '../mouse.ts';

/**
 * Options object for `DragRotateHandler`.
 */
export type DragRotateHandlerOptions = {
    /**
     * Control the map pitch in addition to the bearing
     * @defaultValue true
     */
    pitchWithRotate: boolean;
    /**
     * Control the map roll in addition to the bearing
     * @defaultValue false
     */
    rollEnabled: boolean;
};

/**
 * Options object for {@link DragRotateHandler.enable}.
 */
export type DragRotateOptions = {
    /**
     * If `'pointer'` is passed, the map turns and tilts around the terrain under the pointer where the drag starts,
     * which keeps its place on the screen and its distance from the camera, so tilting also zooms.
     * @defaultValue 'center'
     */
    around?: 'center' | 'pointer';
};

/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 *
 * @group Handlers
 */
export class DragRotateHandler {

    _mouseRotate: MouseRotateHandler;
    _mousePitch: MousePitchHandler;
    _mouseRoll: MouseRollHandler;
    _pitchWithRotate: boolean;
    _rollEnabled: boolean;
    _around: 'center' | 'pointer';

    /** @internal */
    constructor(options: DragRotateHandlerOptions, mouseRotate: MouseRotateHandler, mousePitch: MousePitchHandler, mouseRoll: MouseRollHandler) {
        this._pitchWithRotate = options.pitchWithRotate;
        this._rollEnabled = options.rollEnabled;
        this._mouseRotate = mouseRotate;
        this._mousePitch = mousePitch;
        this._mouseRoll = mouseRoll;
        this._around = 'center';
    }

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @param options - Options object
     * @example
     * ```ts
     * map.dragRotate.enable();
     * map.dragRotate.enable({around: 'pointer'});
     * ```
     */
    enable(options?: DragRotateOptions | boolean): void {
        this._around = typeof options === 'object' ? options.around ?? 'center' : 'center';
        this._mouseRotate.enable();
        if (this._pitchWithRotate) this._mousePitch.enable();
        if (this._rollEnabled) this._mouseRoll.enable();
    }

    /**
     * Disables the "drag to rotate" interaction.
     *
     * @example
     * ```ts
     * map.dragRotate.disable();
     * ```
     */
    disable(): void {
        this._mouseRotate.disable();
        this._mousePitch.disable();
        this._mouseRoll.disable();
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns `true` if the "drag to rotate" interaction is enabled.
     */
    isEnabled(): boolean {
        return this._mouseRotate.isEnabled() && (!this._pitchWithRotate || this._mousePitch.isEnabled()) && (!this._rollEnabled || this._mouseRoll.isEnabled());
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.
     *
     * @returns `true` if the "drag to rotate" interaction is active.
     */
    isActive(): boolean {
        return this._mouseRotate.isActive() || this._mousePitch.isActive() || this._mouseRoll.isActive();
    }
}
