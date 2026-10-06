/**
 * The zoom-out arc of a {@link Camera.flyTo} animation: how far the camera pulls back, and how far
 * along the ground it has travelled, at each point of the flight.
 *
 * The animation and the tile preload that reads ahead of it both take the arc from here, so that the
 * tiles a flight is promised are the tiles that flight actually asks for.
 *
 * @internal
 */
export type FlyToArc = {
    /**
     * The total length of the flight path, measured in ρ-screenfulls.
     */
    S: number;

    /**
     * The visible span at some distance along the path, and how far the camera has come, as the zoom
     * scale and the fraction of the path traveled.
     *
     * @param k - the animation's progress, 0 to 1
     */
    at: (k: number) => {scale: number; centerFactor: number};
};

/**
 * Builds the arc of a flight from its two ends.
 *
 * @param w0 - the visible span the animation starts from, in pixels
 * @param w1 - the visible span it ends at, in pixels with respect to the initial scale
 * @param u1 - the length of the flight path projected onto the ground plane, in pixels with respect to the initial scale
 * @param rho - the zooming curve, where a higher value exaggerates the zoom-out and a value of 1 gives a circular motion
 * @returns the arc, or `null` when the path is too short to have one and the caller should ease instead
 */
export function createFlyToArc(w0: number, w1: number, u1: number, rho: number): FlyToArc | null {
    // ρ²
    const rho2 = rho * rho;

    /**
     * rᵢ: Returns the zoom-out factor at one end of the animation.
     *
     * @param descent - `true` for the descent, `false` for the ascent
     */
    function zoomOutFactor(descent: boolean) {
        const b = (w1 * w1 - w0 * w0 + (descent ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (descent ? w1 : w0) * rho2 * u1);
        return Math.log(Math.sqrt(b * b + 1) - b);
    }

    // r₀: Zoom-out factor during ascent.
    const r0 = zoomOutFactor(false);

    // w(s): Returns the visible span on the ground, measured in pixels with respect to the
    // initial scale. Uses the current vertical field of view setting.
    let w: (_: number) => number = function (s) {
        return (Math.cosh(r0) / Math.cosh(r0 + rho * s));
    };

    // u(s): Returns the distance along the flight path as projected onto the ground plane,
    // measured in pixels from the world image origin at the initial scale.
    let u: (_: number) => number = function (s) {
        return w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / u1;
    };

    // S: Total length of the flight path, measured in ρ-screenfulls.
    let S = (zoomOutFactor(true) - r0) / rho;

    // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
    if (Math.abs(u1) < 0.000002 || !isFinite(S)) {
        // The path is too short to fly: a caller that can ease instead should, and one that cannot
        // animates a straight zoom along the initial center.
        if (Math.abs(w0 - w1) < 0.000001) return null;

        const sign = w1 < w0 ? -1 : 1;
        S = Math.abs(Math.log(w1 / w0)) / rho;

        u = () => 0;
        w = (s) => Math.exp(sign * rho * s);
    }

    return {
        S,
        at: (k) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfulls.
            const s = k * S;
            return {scale: 1 / w(s), centerFactor: u(s)};
        }
    };
}
