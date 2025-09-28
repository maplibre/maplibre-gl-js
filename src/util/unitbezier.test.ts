import {describe, it, expect} from 'vitest';
import {UnitBezier} from './unitbezier';

describe('unit bezier', () => {
    const u = new UnitBezier(0, 0, 1, 1);

    it('sampleCurveY(1) === 1', () => {
        expect(u.sampleCurveY(1)).toBe(1);
    });

    it('sampleCurveX(1) === 1', () => {
        expect(u.sampleCurveX(1)).toBe(1);
    });

    it('sampleCurveDerivativeX(0.1) ≈ 0.54', () => {
        expect(u.sampleCurveDerivativeX(0.1)).toBeCloseTo(0.54, 10);
    });

    it('solveCurveX(0) === 0', () => {
        expect(u.solveCurveX(0)).toBe(0);
    });

    it('solveCurveX(1) === 1', () => {
        expect(u.solveCurveX(1)).toBe(1);
    });

    it('solveCurveX(1.25552, 1e-8) === 1', () => {
        expect(u.solveCurveX(1.25552, 1e-8)).toBe(1);
    });

    it('solveCurveX(1, 1e-8) === 1', () => {
        expect(u.solveCurveX(1, 1e-8)).toBe(1);
    });

    it('solveCurveX(0.5) === 0.5', () => {
        expect(u.solveCurveX(0.5)).toBe(0.5);
    });

    it('solve(0.5) === 0.5', () => {
        expect(u.solve(0.5)).toBe(0.5);
    });
});
