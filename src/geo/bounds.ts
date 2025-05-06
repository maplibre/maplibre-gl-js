import Point from '@mapbox/point-geometry';

type PointLike = {x: number; y: number};

export default class Bounds {
    minX: number = Infinity;
    maxX: number = -Infinity;
    minY: number = Infinity;
    maxY: number = -Infinity;

    extend(point: PointLike): this {
        this.minX = Math.min(this.minX, point.x);
        this.minY = Math.min(this.minY, point.y);
        this.maxX = Math.max(this.maxX, point.x);
        this.maxY = Math.max(this.maxY, point.y);
        return this;
    }

    static fromPoints(points: PointLike[]): Bounds {
        const result = new Bounds();
        for (const p of points) {
            result.extend(p);
        }
        return result;
    }

    center(): Point {
        return new Point((this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2);
    }

    contains(point: PointLike): boolean {
        return point.x >= this.minX && point.x <= this.maxX && point.y >= this.minY && point.y <= this.maxY;
    }

    empty(): boolean {
        return this.minX > this.maxX;
    }
}