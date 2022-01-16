declare module 'grid-index' {
    class TransferableGridIndex {
        constructor(extent: number, n: number, padding: number);
        constructor(arrayBuffer: ArrayBuffer);
        insert(key: number, x1: number, y1: number, x2: number, y2: number);
        query(x1: number, y1: number, x2: number, y2: number, intersectionTest?: Function): number[];
        toArrayBuffer(): ArrayBuffer;
    }
    export default TransferableGridIndex;
}