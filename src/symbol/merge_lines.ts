import type Point from '@mapbox/point-geometry';
import type {SymbolFeature} from '../data/bucket/symbol_bucket.ts';

type LineChunk = {
    points: Point[];
    next: LineChunk | null;
};

type MergedLine = {
    feature: SymbolFeature;
    first: LineChunk;
    last: LineChunk;
};

function getKey(text: string, line: MergedLine, onRight?: boolean) {
    const points = onRight ? line.last.points : line.first.points;
    const point = onRight ? points[points.length - 1] : points[0];
    return `${text}:${point.x}:${point.y}`;
}

function joinChunks(line: MergedLine): Point[] {
    const first = line.first.points;
    let length = first.length;
    for (let chunk = line.first.next; chunk; chunk = chunk.next) {
        length += chunk.points.length - 1;
    }

    const points = new Array<Point>(length);
    for (let i = 0; i < first.length; i++) {
        points[i] = first[i];
    }

    let at = first.length;
    for (let chunk = line.first.next; chunk; chunk = chunk.next) {
        const from = chunk.points;
        for (let i = 1; i < from.length; i++) {
            points[at++] = from[i];
        }
    }
    return points;
}

function mergeFromRight(merged: MergedLine[], rightIndex: Record<string, number>, leftKey: string, rightKey: string, line: MergedLine) {
    const i = rightIndex[leftKey];
    delete rightIndex[leftKey];
    rightIndex[rightKey] = i;

    const target = merged[i];
    target.last.next = line.first;
    target.last = line.last;
    return i;
}

function mergeFromLeft(merged: MergedLine[], leftIndex: Record<string, number>, leftKey: string, rightKey: string, line: MergedLine) {
    const i = leftIndex[rightKey];
    delete leftIndex[rightKey];
    leftIndex[leftKey] = i;

    const target = merged[i];
    line.last.next = target.first;
    target.first = line.first;
    return i;
}

export function mergeLines(features: SymbolFeature[]): SymbolFeature[] {
    const leftIndex: Record<string, number> = {};
    const rightIndex: Record<string, number> = {};
    const merged: MergedLine[] = [];

    for (const feature of features) {
        const text = feature.text ? feature.text.toString() : null;

        const chunk: LineChunk = {points: feature.geometry[0], next: null};
        const line: MergedLine = {feature, first: chunk, last: chunk};

        if (!text) {
            merged.push(line);
            continue;
        }

        const leftKey = getKey(text, line),
            rightKey = getKey(text, line, true);

        if ((leftKey in rightIndex) && (rightKey in leftIndex) && (rightIndex[leftKey] !== leftIndex[rightKey])) {
            // found lines with the same text adjacent to both ends of the current line, merge all three
            const j = mergeFromLeft(merged, leftIndex, leftKey, rightKey, line);
            const i = mergeFromRight(merged, rightIndex, leftKey, rightKey, merged[j]);

            delete leftIndex[leftKey];
            delete rightIndex[rightKey];

            rightIndex[getKey(text, merged[i], true)] = i;
            merged[j].feature.geometry = null;

        } else if (leftKey in rightIndex) {
            // found mergeable line adjacent to the start of the current line, merge
            mergeFromRight(merged, rightIndex, leftKey, rightKey, line);

        } else if (rightKey in leftIndex) {
            // found mergeable line adjacent to the end of the current line, merge
            mergeFromLeft(merged, leftIndex, leftKey, rightKey, line);

        } else {
            // no adjacent lines, add as a new item
            const i = merged.push(line) - 1;
            leftIndex[leftKey] = i;
            rightIndex[rightKey] = i;
        }
    }

    const result: SymbolFeature[] = [];
    for (const line of merged) {
        const feature = line.feature;
        if (!feature.geometry) continue;
        if (line.first.next) feature.geometry[0] = joinChunks(line);
        result.push(feature);
    }
    return result;
}
