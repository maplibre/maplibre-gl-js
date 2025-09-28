export class UnitBezier {
    private ax: number;
    private bx: number;
    private cx: number;
    private ay: number;
    private by: number;
    private cy: number;

    public readonly p1x: number;
    public readonly p1y: number;
    public readonly p2x: number;
    public readonly p2y: number;

    constructor(p1x: number, p1y: number, p2x: number, p2y: number) {
        this.cx = 3.0 * p1x;
        this.bx = 3.0 * (p2x - p1x) - this.cx;
        this.ax = 1.0 - this.cx - this.bx;

        this.cy = 3.0 * p1y;
        this.by = 3.0 * (p2y - p1y) - this.cy;
        this.ay = 1.0 - this.cy - this.by;

        this.p1x = p1x;
        this.p1y = p1y;
        this.p2x = p2x;
        this.p2y = p2y;
    }

    sampleCurveX(t: number): number {
        return ((this.ax * t + this.bx) * t + this.cx) * t;
    }

    sampleCurveY(t: number): number {
        return ((this.ay * t + this.by) * t + this.cy) * t;
    }

    sampleCurveDerivativeX(t: number): number {
        return (3.0 * this.ax * t + 2.0 * this.bx) * t + this.cx;
    }

    solveCurveX(x: number, epsilon: number = 1e-6): number {
        if (x < 0.0) return 0.0;
        if (x > 1.0) return 1.0;

        let t = x;

        for (let i = 0; i < 8; i++) {
            const x2 = this.sampleCurveX(t) - x;
            if (Math.abs(x2) < epsilon) return t;
            const d2 = this.sampleCurveDerivativeX(t);
            if (Math.abs(d2) < 1e-6) break;
            t = t - x2 / d2;
        }

        let t0 = 0.0;
        let t1 = 1.0;
        t = x;

        for (let i = 0; i < 20; i++) {
            const x2 = this.sampleCurveX(t);
            if (Math.abs(x2 - x) < epsilon) break;
            if (x > x2) {
                t0 = t;
            } else {
                t1 = t;
            }
            t = (t1 - t0) * 0.5 + t0;
        }

        return t;
    }

    solve(x: number, epsilon?: number): number {
        return this.sampleCurveY(this.solveCurveX(x, epsilon));
    }
}
