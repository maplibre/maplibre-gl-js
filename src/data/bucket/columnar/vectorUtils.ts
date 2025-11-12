import {type GeometryVector} from '@maplibre/mlt';
import Point from '@mapbox/point-geometry';

export default class VectorUtils{
    private VectorUtils(){}

    static equals (x1: number, y1: number, x2: number, y2: number): boolean {
        return x1 === x2 && y1 === y2;
    }

    static equalsVertex(geometryVector: GeometryVector, index1: number, index2: number): boolean {
        const vertex1 = geometryVector.getVertex(index1);
        const vertex2 = geometryVector.getVertex(index2);
        return vertex1[0] === vertex2[0] && vertex1[1] === vertex2[1];
    }

    static sub(x1: number, y1: number, x2: number, y2: number): Point {
        const x = x1 - x2;
        const y = y1 - y2;
        return new Point(x, y);
    }

    static subPoint(x1: number, y1: number, point: Point): Point {
        const x = x1 - point.x;
        const y = y1 - point.y ;
        return new Point(x, y);
    }

    static dist(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static add(x1: number, y1: number, x2: number, y2: number){
        const x = x1 + x2;
        const y = y1 + y2;
        return new Point(x, y);
    }

}
