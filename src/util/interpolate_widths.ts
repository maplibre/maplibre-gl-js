/**
 * Interpolates a piecewise-linear width profile at a normalized position.
 *
 * `widths` holds one width per vertex of a line, `knots` holds the matching
 * normalized cumulative distance (0..1) of those vertices. When the line is
 * rendered, the width at an arbitrary point is a linear blend between the two
 * neighbouring knots — so a width given "per vertex" is reproduced exactly at
 * that vertex, and everything in between varies with the actual geometry.
 *
 * If `widths` and `knots` have different lengths (e.g. an array that does not
 * match the vertex count, or a subdivided globe line), the widths are treated
 * as evenly spaced stops instead — a graceful fallback instead of an error.
 */
export function interpolateWidthProfile(widths: readonly number[], knots: readonly number[], t: number): number {
    const n = widths.length;
    if (n === 0) return 0;
    if (n === 1) return widths[0];
    if (knots.length !== n) {
        return interpolateEvenlySpaced(widths, t);
    }
    const clamped = Math.min(Math.max(t, 0), 1);
    if (clamped <= knots[0]) return widths[0];
    if (clamped >= knots[n - 1]) return widths[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (knots[mid] <= clamped) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    const f = knots[hi] > knots[lo] ? (clamped - knots[lo]) / (knots[hi] - knots[lo]) : 0;
    return widths[lo] + (widths[hi] - widths[lo]) * f;
}

function interpolateEvenlySpaced(widths: readonly number[], t: number): number {
    const n = widths.length;
    const clamped = Math.min(Math.max(t, 0), 1);
    const scaled = clamped * (n - 1);
    const i = Math.min(Math.floor(scaled), n - 2);
    const f = scaled - i;
    return widths[i] + (widths[i + 1] - widths[i]) * f;
}