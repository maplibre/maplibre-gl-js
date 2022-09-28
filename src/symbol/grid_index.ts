import type {OverlapMode} from '../style/style_layer/symbol_style_layer';

type QueryArgs = {
    hitTest: boolean;
    overlapMode?: OverlapMode;
    circle?: {
        x: number;
        y: number;
        radius: number;
    };
    seenUids: {
        box: {
            [_: number]: boolean;
        };
        circle: {
            [_: number]: boolean;
        };
    };
};

type QueryResult<T> = {
    key: T;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

export type GridKey = {
    overlapMode?: OverlapMode;
}

function overlapAllowed(overlapA: OverlapMode, overlapB: OverlapMode): boolean {
    let allowed = true;

    if (overlapA === 'always') {
        // symbol A using 'always' overlap - allowed to overlap anything.
    } else if (overlapA === 'never' || overlapB === 'never') {
        // symbol A using 'never' overlap - can't overlap anything
        // symbol A using 'cooperative' overlap - can overlap 'always' or 'cooperative' symbol; can't overlap 'never'
        allowed = false;
    }

    return allowed;
}

/**
 * GridIndex is a data structure for testing the intersection of
 * circles and rectangles in a 2d plane.
 * It is optimized for rapid insertion and querying.
 * GridIndex splits the plane into a set of "cells" and keeps track
 * of which geometries intersect with each cell. At query time,
 * full geometry comparisons are only done for items that share
 * at least one cell. As long as the geometries are relatively
 * uniformly distributed across the plane, this greatly reduces
 * the number of comparisons necessary.
 *
 * @private
 */
class GridIndex<T extends GridKey> {
    circleKeys: Array<T>;
    boxKeys: Array<T>;
    boxCells: Array<Array<number>>;
    circleCells: Array<Array<number>>;
    bboxes: Array<number>;
    circles: Array<number>;
    xCellCount: number;
    yCellCount: number;
    width: number;
    height: number;
    xScale: number;
    yScale: number;
    boxUid: number;
    circleUid: number;

    constructor (width: number, height: number, cellSize: number) {
        const boxCells = this.boxCells = [];
        const circleCells = this.circleCells = [];

        // More cells -> fewer geometries to check per cell, but items tend
        // to be split across more cells.
        // Sweet spot allows most small items to fit in one cell
        this.xCellCount = Math.ceil(width / cellSize);
        this.yCellCount = Math.ceil(height / cellSize);

        for (let i = 0; i < this.xCellCount * this.yCellCount; i++) {
            boxCells.push([]);
            circleCells.push([]);
        }
        this.circleKeys = [];
        this.boxKeys = [];
        this.bboxes = [];
        this.circles = [];

        this.width = width;
        this.height = height;
        this.xScale = this.xCellCount / width;
        this.yScale = this.yCellCount / height;
        this.boxUid = 0;
        this.circleUid = 0;
    }

    keysLength() {
        return this.boxKeys.length + this.circleKeys.length;
    }

    insert(key: T, x1: number, y1: number, x2: number, y2: number) {
        this._forEachCell(x1, y1, x2, y2, this._insertBoxCell, this.boxUid++);
        this.boxKeys.push(key);
        this.bboxes.push(x1);
        this.bboxes.push(y1);
        this.bboxes.push(x2);
        this.bboxes.push(y2);
    }

    insertCircle(key: T, x: number, y: number, radius: number) {
        // Insert circle into grid for all cells in the circumscribing square
        // It's more than necessary (by a factor of 4/PI), but fast to insert
        this._forEachCell(x - radius, y - radius, x + radius, y + radius, this._insertCircleCell, this.circleUid++);
        this.circleKeys.push(key);
        this.circles.push(x);
        this.circles.push(y);
        this.circles.push(radius);
    }

    private _insertBoxCell(x1: number, y1: number, x2: number, y2: number, cellIndex: number, uid: number) {
        this.boxCells[cellIndex].push(uid);
    }

    private _insertCircleCell(x1: number, y1: number, x2: number, y2: number, cellIndex: number, uid: number)  {
        this.circleCells[cellIndex].push(uid);
    }

    private _query(x1: number, y1: number, x2: number, y2: number, hitTest: boolean, overlapMode: OverlapMode, predicate?: (key: T) => boolean): Array<QueryResult<T>> {
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
            return [];
        }
        const result: Array<QueryResult<T>> = [];
        if (x1 <= 0 && y1 <= 0 && this.width <= x2 && this.height <= y2) {
            if (hitTest) {
                // Covers the entire grid, so collides with everything
                return [{
                    key: null,
                    x1,
                    y1,
                    x2,
                    y2
                }];
            }
            for (let boxUid = 0; boxUid < this.boxKeys.length; boxUid++) {
                result.push({
                    key: this.boxKeys[boxUid],
                    x1: this.bboxes[boxUid * 4],
                    y1: this.bboxes[boxUid * 4 + 1],
                    x2: this.bboxes[boxUid * 4 + 2],
                    y2: this.bboxes[boxUid * 4 + 3]
                });
            }
            for (let circleUid = 0; circleUid < this.circleKeys.length; circleUid++) {
                const x = this.circles[circleUid * 3];
                const y = this.circles[circleUid * 3 + 1];
                const radius = this.circles[circleUid * 3 + 2];
                result.push({
                    key: this.circleKeys[circleUid],
                    x1: x - radius,
                    y1: y - radius,
                    x2: x + radius,
                    y2: y + radius
                });
            }
        } else {
            const queryArgs: QueryArgs = {
                hitTest,
                overlapMode,
                seenUids: {box: {}, circle: {}}
            };
            this._forEachCell(x1, y1, x2, y2, this._queryCell, result, queryArgs, predicate);
        }

        return result;
    }

    query(x1: number, y1: number, x2: number, y2: number): Array<QueryResult<T>> {
        return this._query(x1, y1, x2, y2, false, null);
    }

    hitTest(x1: number, y1: number, x2: number, y2: number, overlapMode: OverlapMode, predicate?: (key: T) => boolean): boolean {
        return this._query(x1, y1, x2, y2, true, overlapMode, predicate).length > 0;
    }

    hitTestCircle(x: number, y: number, radius: number, overlapMode: OverlapMode, predicate?: (key: T) => boolean): boolean {
        // Insert circle into grid for all cells in the circumscribing square
        // It's more than necessary (by a factor of 4/PI), but fast to insert
        const x1 = x - radius;
        const x2 = x + radius;
        const y1 = y - radius;
        const y2 = y + radius;
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
            return false;
        }

        // Box query early exits if the bounding box is larger than the grid, but we don't do
        // the equivalent calculation for circle queries because early exit is less likely
        // and the calculation is more expensive
        const result: boolean[] = [];
        const queryArgs: QueryArgs = {
            hitTest: true,
            overlapMode,
            circle: {x, y, radius},
            seenUids: {box: {}, circle: {}}
        };
        this._forEachCell(x1, y1, x2, y2, this._queryCellCircle, result, queryArgs, predicate);
        return result.length > 0;
    }

    private _queryCell(x1: number, y1: number, x2: number, y2: number, cellIndex: number, result: Array<QueryResult<T>>, queryArgs: QueryArgs, predicate?: (key: T) => boolean): boolean {
        const {seenUids, hitTest, overlapMode} = queryArgs;
        const boxCell = this.boxCells[cellIndex];

        if (boxCell !== null) {
            const bboxes = this.bboxes;
            for (const boxUid of boxCell) {
                if (!seenUids.box[boxUid]) {
                    seenUids.box[boxUid] = true;
                    const offset = boxUid * 4;
                    const key = this.boxKeys[boxUid];

                    if ((x1 <= bboxes[offset + 2]) &&
                        (y1 <= bboxes[offset + 3]) &&
                        (x2 >= bboxes[offset + 0]) &&
                        (y2 >= bboxes[offset + 1]) &&
                        (!predicate || predicate(key))) {
                        if (!hitTest || !overlapAllowed(overlapMode, key.overlapMode)) {
                            result.push({
                                key,
                                x1: bboxes[offset],
                                y1: bboxes[offset + 1],
                                x2: bboxes[offset + 2],
                                y2: bboxes[offset + 3]
                            });
                            if (hitTest) {
                                // true return value stops the query after first match
                                return true;
                            }
                        }
                    }
                }
            }
        }
        const circleCell = this.circleCells[cellIndex];
        if (circleCell !== null) {
            const circles = this.circles;
            for (const circleUid of circleCell) {
                if (!seenUids.circle[circleUid]) {
                    seenUids.circle[circleUid] = true;
                    const offset = circleUid * 3;
                    const key = this.circleKeys[circleUid];

                    if (this._circleAndRectCollide(
                        circles[offset],
                        circles[offset + 1],
                        circles[offset + 2],
                        x1,
                        y1,
                        x2,
                        y2) &&
                        (!predicate || predicate(key))) {
                        if (!hitTest || !overlapAllowed(overlapMode, key.overlapMode)) {
                            const x = circles[offset];
                            const y = circles[offset + 1];
                            const radius = circles[offset + 2];
                            result.push({
                                key,
                                x1: x - radius,
                                y1: y - radius,
                                x2: x + radius,
                                y2: y + radius
                            });
                            if (hitTest) {
                                // true return value stops the query after first match
                                return true;
                            }
                        }
                    }
                }
            }
        }

        // false return to continue query
        return false;
    }

    private _queryCellCircle(x1: number, y1: number, x2: number, y2: number, cellIndex: number, result: Array<boolean>, queryArgs: QueryArgs, predicate?: (key: T) => boolean): boolean {
        const {circle, seenUids, overlapMode} = queryArgs;
        const boxCell = this.boxCells[cellIndex];

        if (boxCell !== null) {
            const bboxes = this.bboxes;
            for (const boxUid of boxCell) {
                if (!seenUids.box[boxUid]) {
                    seenUids.box[boxUid] = true;
                    const offset = boxUid * 4;
                    const key = this.boxKeys[boxUid];
                    if (this._circleAndRectCollide(
                        circle.x,
                        circle.y,
                        circle.radius,
                        bboxes[offset + 0],
                        bboxes[offset + 1],
                        bboxes[offset + 2],
                        bboxes[offset + 3]) &&
                        (!predicate || predicate(key)) &&
                        !overlapAllowed(overlapMode, key.overlapMode)) {
                        result.push(true);
                        return true;
                    }
                }
            }
        }

        const circleCell = this.circleCells[cellIndex];
        if (circleCell !== null) {
            const circles = this.circles;
            for (const circleUid of circleCell) {
                if (!seenUids.circle[circleUid]) {
                    seenUids.circle[circleUid] = true;
                    const offset = circleUid * 3;
                    const key = this.circleKeys[circleUid];
                    if (this._circlesCollide(
                        circles[offset],
                        circles[offset + 1],
                        circles[offset + 2],
                        circle.x,
                        circle.y,
                        circle.radius) &&
                        (!predicate || predicate(key)) &&
                        !overlapAllowed(overlapMode, key.overlapMode)) {
                        result.push(true);
                        return true;
                    }
                }
            }
        }
    }

    private _forEachCell<TArg>(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        fn: (x1: number, y1: number, x2: number, y2: number, cellIndex: number, arg1: TArg, arg2?: QueryArgs, predicate?: (key: T) => boolean) => boolean | void,
        arg1: TArg,
        arg2?: QueryArgs,
        predicate?: (key: T) => boolean) {
        const cx1 = this._convertToXCellCoord(x1);
        const cy1 = this._convertToYCellCoord(y1);
        const cx2 = this._convertToXCellCoord(x2);
        const cy2 = this._convertToYCellCoord(y2);

        for (let x = cx1; x <= cx2; x++) {
            for (let y = cy1; y <= cy2; y++) {
                const cellIndex = this.xCellCount * y + x;
                if (fn.call(this, x1, y1, x2, y2, cellIndex, arg1, arg2, predicate)) return;
            }
        }
    }

    private _convertToXCellCoord(x: number) {
        return Math.max(0, Math.min(this.xCellCount - 1, Math.floor(x * this.xScale)));
    }

    private _convertToYCellCoord(y: number) {
        return Math.max(0, Math.min(this.yCellCount - 1, Math.floor(y * this.yScale)));
    }

    private _circlesCollide(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const bothRadii = r1 + r2;
        return (bothRadii * bothRadii) > (dx * dx + dy * dy);
    }

    private _circleAndRectCollide(
        circleX: number,
        circleY: number,
        radius: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): boolean {
        const halfRectWidth = (x2 - x1) / 2;
        const distX = Math.abs(circleX - (x1 + halfRectWidth));
        if (distX > (halfRectWidth + radius)) {
            return false;
        }

        const halfRectHeight = (y2 - y1) / 2;
        const distY = Math.abs(circleY - (y1 + halfRectHeight));
        if (distY > (halfRectHeight + radius)) {
            return false;
        }

        if (distX <= halfRectWidth || distY <= halfRectHeight) {
            return true;
        }

        const dx = distX - halfRectWidth;
        const dy = distY - halfRectHeight;
        return (dx * dx + dy * dy <= (radius * radius));
    }
}

export default GridIndex;
