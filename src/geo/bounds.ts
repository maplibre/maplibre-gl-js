import Point from '@mapbox/point-geometry';
import {type Point2D} from '@maplibre/maplibre-gl-style-spec';

export interface ReadOnlyBounds {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;

    /**
     * Returns whether this bounding box contains a point
     * 
     * @param point - The point to check
     * @returns True if this bounding box contains point, false otherwise.
     */
    contains(point: Point2D): boolean;

    /**
     * Returns true if this bounding box contains no points
     * 
     * @returns True if this bounding box contains no points.
     */
    empty(): boolean;

    /**
     * Returns the width of this bounding box.
     * 
     * @returns `maxX - minX`.
     */
    width(): number;

    /**
     * Returns the height of this bounding box.
     * 
     * @returns `maxY - minY`.
     */
    height(): number;

    /**
     * Returns true if this bounding box completely covers `other`.
     * 
     * @param other - The other bounding box
     * @returns True if this bounding box completely encloses `other`
     */
    covers(other: ReadOnlyBounds): boolean;

    /**
     * Returns true if this bounding box touches any part of `other`.
     * 
     * @param other - The other bounding box
     * @returns True if this bounding box touches any part of `other`.
     */
    intersects(other: ReadOnlyBounds): boolean;
}

/** A 2-d bounding box covering an X and Y range. */
export class Bounds implements ReadOnlyBounds {
    minX: number = Infinity;
    maxX: number = -Infinity;
    minY: number = Infinity;
    maxY: number = -Infinity;

    /**
     * Expands this bounding box to include point.
     * 
     * @param point - The point to include in this bounding box
     * @returns This mutated bounding box
     */
    extend(point: Point2D): this {
        this.minX = Math.min(this.minX, point.x);
        this.minY = Math.min(this.minY, point.y);
        this.maxX = Math.max(this.maxX, point.x);
        this.maxY = Math.max(this.maxY, point.y);
        return this;
    }

    /**
     * Expands this bounding box by a fixed amount in each direction.
     * 
     * @param amount - The amount to expand the box by, or contract if negative
     * @returns This mutated bounding box
     */
    expandBy(amount: number): this {
        this.minX -= amount;
        this.minY -= amount;
        this.maxX += amount;
        this.maxY += amount;
        // check if bounds collapsed in either dimension
        if (this.minX > this.maxX || this.minY > this.maxY) {
            this.minX = Infinity;
            this.maxX = -Infinity;
            this.minY = Infinity;
            this.maxY = -Infinity;
        }
        return this;
    }

    /**
     * Shrinks this bounding box by a fixed amount in each direction.
     * 
     * @param amount - The amount to shrink the box by
     * @returns This mutated bounding box
     */
    shrinkBy(amount: number): this {
        return this.expandBy(-amount);
    }

    /**
     * Returns a new bounding box that contains all of the corners of this bounding
     * box with a transform applied. Does not modify this bounding box.
     * 
     * @param fn - The function to apply to each corner
     * @returns A new bounding box containing all of the mapped points.
     */
    map(fn: (point: Point2D) => Point2D) {
        const result = new Bounds();
        result.extend(fn(new Point(this.minX, this.minY)));
        result.extend(fn(new Point(this.maxX, this.minY)));
        result.extend(fn(new Point(this.minX, this.maxY)));
        result.extend(fn(new Point(this.maxX, this.maxY)));
        return result;
    }

    /**
     * Creates a new bounding box that includes all points provided.
     * 
     * @param points - The points to include inside the bounding box
     * @returns The new bounding box
     */
    static fromPoints(points: Point2D[]): Bounds {
        const result = new Bounds();
        for (const p of points) {
            result.extend(p);
        }
        return result;
    }

    contains(point: Point2D): boolean {
        return point.x >= this.minX && point.x <= this.maxX && point.y >= this.minY && point.y <= this.maxY;
    }

    empty(): boolean {
        return this.minX > this.maxX;
    }

    width(): number {
        return this.maxX - this.minX;
    }

    height(): number {
        return this.maxY - this.minY;
    }

    covers(other: ReadOnlyBounds) {
        return !this.empty() && !other.empty() &&
            other.minX >= this.minX &&
            other.maxX <= this.maxX &&
            other.minY >= this.minY &&
            other.maxY <= this.maxY;
    }

    intersects(other: ReadOnlyBounds) {
        return !this.empty() && !other.empty() &&
            other.minX <= this.maxX &&
            other.maxX >= this.minX &&
            other.minY <= this.maxY &&
            other.maxY >= this.minY;
    }
}
