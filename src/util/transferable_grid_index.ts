/*
This file was copied from https://github.com/mapbox/grid-index and was
migrated from JavaScript to TypeScript.

Copyright (c) 2016, Mapbox

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
*/

const NUM_PARAMS = 3;

export type SerializedGrid = {
    buffer: ArrayBuffer;
};

export class TransferableGridIndex {
    cells: number[][];
    arrayBuffer: ArrayBuffer;
    d: number;
    keys: number[];
    bboxes: number[];
    n: number;
    extent: number;
    padding: number;
    scale: any;
    uid: number;
    min: number;
    max: number;

    constructor(extent: number | ArrayBuffer, n?: number, padding?: number) {
        const cells = this.cells = [];

        if (extent instanceof ArrayBuffer) {
            this.arrayBuffer = extent;
            const array = new Int32Array(this.arrayBuffer);
            extent = array[0];
            n = array[1];
            padding = array[2];

            this.d = n + 2 * padding;
            for (let k = 0; k < this.d * this.d; k++) {
                const start = array[NUM_PARAMS + k];
                const end = array[NUM_PARAMS + k + 1];
                cells.push(start === end ? null : array.subarray(start, end));
            }
            const keysOffset = array[NUM_PARAMS + cells.length];
            const bboxesOffset = array[NUM_PARAMS + cells.length + 1];
            this.keys = array.subarray(keysOffset, bboxesOffset) as any as number[];
            this.bboxes = array.subarray(bboxesOffset) as any as number[];

            this.insert = this._insertReadonly;

        } else {
            this.d = n + 2 * padding;
            for (let i = 0; i < this.d * this.d; i++) {
                cells.push([]);
            }
            this.keys = [];
            this.bboxes = [];
        }

        this.n = n;
        this.extent = extent;
        this.padding = padding;
        this.scale = n / extent;
        this.uid = 0;

        const p = (padding / n) * extent;
        this.min = -p;
        this.max = extent + p;
    }

    insert(key: number, x1: number, y1: number, x2: number, y2: number) {
        this._forEachCell(x1, y1, x2, y2, this._insertCell, this.uid++, undefined, undefined);
        this.keys.push(key);
        this.bboxes.push(x1);
        this.bboxes.push(y1);
        this.bboxes.push(x2);
        this.bboxes.push(y2);
    }

    _insertReadonly() {
        throw new Error('Cannot insert into a GridIndex created from an ArrayBuffer.');
    }

    _insertCell(x1: number, y1: number, x2: number, y2: number, cellIndex: number, uid: number) {
        this.cells[cellIndex].push(uid);
    }

    query(x1: number, y1: number, x2: number, y2: number, intersectionTest?: Function): number[] {
        const min = this.min;
        const max = this.max;
        if (x1 <= min && y1 <= min && max <= x2 && max <= y2 && !intersectionTest) {
            // We use `Array.slice` because `this.keys` may be a `Int32Array` and
            // some browsers (Safari and IE) do not support `TypedArray.slice`
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Browser_compatibility
            return Array.prototype.slice.call(this.keys);

        } else {
            const result = [];
            const seenUids = {};
            this._forEachCell(x1, y1, x2, y2, this._queryCell, result, seenUids, intersectionTest);
            return result;
        }
    }

    _queryCell(x1: number, y1: number, x2: number, y2:number, cellIndex:number, result, seenUids, intersectionTest: Function) {
        const cell = this.cells[cellIndex];
        if (cell !== null) {
            const keys = this.keys;
            const bboxes = this.bboxes;
            for (let u = 0; u < cell.length; u++) {
                const uid = cell[u];
                if (seenUids[uid] === undefined) {
                    const offset = uid * 4;
                    if (intersectionTest ?
                        intersectionTest(bboxes[offset + 0], bboxes[offset + 1], bboxes[offset + 2], bboxes[offset + 3]) :
                        ((x1 <= bboxes[offset + 2]) &&
                        (y1 <= bboxes[offset + 3]) &&
                        (x2 >= bboxes[offset + 0]) &&
                        (y2 >= bboxes[offset + 1]))) {
                        seenUids[uid] = true;
                        result.push(keys[uid]);
                    } else {
                        seenUids[uid] = false;
                    }
                }
            }
        }
    }

    _forEachCell(x1: number, y1: number, x2:number, y2:number, fn: Function, arg1, arg2, intersectionTest) {
        const cx1 = this._convertToCellCoord(x1);
        const cy1 = this._convertToCellCoord(y1);
        const cx2 = this._convertToCellCoord(x2);
        const cy2 = this._convertToCellCoord(y2);
        for (let x = cx1; x <= cx2; x++) {
            for (let y = cy1; y <= cy2; y++) {
                const cellIndex = this.d * y + x;
                if (intersectionTest && !intersectionTest(
                    this._convertFromCellCoord(x),
                    this._convertFromCellCoord(y),
                    this._convertFromCellCoord(x + 1),
                    this._convertFromCellCoord(y + 1))) continue;
                if (fn.call(this, x1, y1, x2, y2, cellIndex, arg1, arg2, intersectionTest)) return;
            }
        }
    }

    _convertFromCellCoord (x) {
        return (x - this.padding) / this.scale;
    }

    _convertToCellCoord(x) {
        return Math.max(0, Math.min(this.d - 1, Math.floor(x * this.scale) + this.padding));
    }

    toArrayBuffer(): ArrayBuffer {
        if (this.arrayBuffer) return this.arrayBuffer;

        const cells = this.cells;

        const metadataLength = NUM_PARAMS + this.cells.length + 1 + 1;
        let totalCellLength = 0;
        for (let i = 0; i < this.cells.length; i++) {
            totalCellLength += this.cells[i].length;
        }

        const array = new Int32Array(metadataLength + totalCellLength + this.keys.length + this.bboxes.length);
        array[0] = this.extent;
        array[1] = this.n;
        array[2] = this.padding;

        let offset = metadataLength;
        for (let k = 0; k < cells.length; k++) {
            const cell = cells[k];
            array[NUM_PARAMS + k] = offset;
            array.set(cell, offset);
            offset += cell.length;
        }

        array[NUM_PARAMS + cells.length] = offset;
        array.set(this.keys, offset);
        offset += this.keys.length;

        array[NUM_PARAMS + cells.length + 1] = offset;
        array.set(this.bboxes, offset);
        offset += this.bboxes.length;

        return array.buffer;
    }

    public static serialize(grid: TransferableGridIndex, transferables?: Array<Transferable>): SerializedGrid {
        const buffer = grid.toArrayBuffer();
        if (transferables) {
            transferables.push(buffer);
        }
        return {buffer};
    }

    public static deserialize(serialized: SerializedGrid): TransferableGridIndex {
        return new TransferableGridIndex(serialized.buffer);
    }
}
