import {describe, expect, test} from 'vitest';
import {createFlyToArc} from './fly_to_arc.ts';

describe('createFlyToArc', () => {
    test('starts where the animation starts', () => {
        const arc = createFlyToArc(512, 256, 1024, 1.42);

        // The animation's zoom scale is 1 at the start, and it has covered no ground. Neither is worked
        // out by a subtraction that cancels, so neither is bit-exact zero however it is written; what
        // matters is that the camera begins where it was.
        expect(arc.at(0).scale).toBe(1);
        expect(arc.at(0).centerFactor).toBeCloseTo(0, 10);
    });

    test('travels the whole of the path and no more', () => {
        const arc = createFlyToArc(512, 256, 1024, 1.42);

        expect(arc.at(1).centerFactor).toBeCloseTo(1, 10);
    });

    test('never travels backwards', () => {
        const arc = createFlyToArc(512, 256, 8192, 1.42);

        let previous = -Infinity;
        for (let step = 0; step <= 20; step++) {
            const centerFactor = arc.at(step / 20).centerFactor;
            expect(centerFactor).toBeGreaterThanOrEqual(previous);
            previous = centerFactor;
        }
    });

    test('has no arc for a path too short to have one', () => {
        // Nothing to fly between and nothing to zoom between: the caller eases instead.
        expect(createFlyToArc(512, 512, 0, 1.42)).toBeNull();
        expect(createFlyToArc(512, 512, 0.0000001, 1.42)).toBeNull();
    });

    test('zooms straight down when there is nowhere to fly but there is zoom to cover', () => {
        const arc = createFlyToArc(512, 256, 0, 1.42);

        // The camera keeps the center it started on and only zooms, which covers the whole way in
        // half the animation.
        expect(arc.at(0.5).centerFactor).toBe(0);
        expect(arc.at(0.5).scale).toBeCloseTo(Math.sqrt(512 / 256), 10);
        expect(arc.at(1).scale).toBeCloseTo(512 / 256, 10);
    });

    test('reports a path length the animation can pace itself from', () => {
        const arc = createFlyToArc(512, 64, 4096, 1.42);

        expect(arc.S).toBeGreaterThan(0);
        expect(isFinite(arc.S)).toBe(true);
    });
});