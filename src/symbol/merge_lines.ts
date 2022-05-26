import Point from '@mapbox/point-geometry';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';

export default function mergeLines(features: Array<SymbolFeature>): Array<SymbolFeature> {
    const leftIndex: {[_: string]: [number, number]} = {};
    const rightIndex: {[_: string]: [number, number]} = {};
    // merged subcomponents per each feature
    const mergedComponents: { [_: number]: { [_: number]: Point[] | null }} = [];
    const noTextFeatures: SymbolFeature[] = [];
    function mergeFromRight(leftKey: string, rightKey: string, geom) {
        const [i, j] = rightIndex[leftKey];
        delete rightIndex[leftKey];
        rightIndex[rightKey] = [i, j];

        mergedComponents[i][j].pop();
        mergedComponents[i][j] = mergedComponents[i][j].concat(geom);
        return [i, j];
    }

    function mergeFromLeft(leftKey: string, rightKey: string, geom) {
        const [i, j] = leftIndex[rightKey];
        delete leftIndex[rightKey];
        leftIndex[leftKey] = [i, j];

        mergedComponents[i][j].shift();
        mergedComponents[i][j] = geom.concat(mergedComponents[i][j]);
        return [i, j];
    }

    function getKey(text, geom, onRight?) {
        const point = onRight ? geom[geom.length - 1] : geom[0];
        return `${text}:${point.x}:${point.y}`;
    }

    for (let k = 0; k < features.length; k++) {
        const feature = features[k];
        const geom = feature.geometry;
        const text = feature.text ? feature.text.toString() : null;

        if (!text) {
            noTextFeatures.push(feature);
            continue;
        }

        for (let c = 0; c < geom.length; c++) {
            const comp = geom[c];
            // ensure l-to-r orientation of each segment
            if (comp[0].x > comp[comp.length - 1].x) {
                comp.reverse();
            }
            const leftKey = getKey(text, comp),
                rightKey = getKey(text, comp, true);
            if ((leftKey in rightIndex) && (rightKey in leftIndex) && (rightIndex[leftKey] !== leftIndex[rightKey])) {
                // found lines with the same text adjacent to both ends of the current line, merge all three
                const [w, z] = mergeFromLeft(leftKey, rightKey, comp);
                const [i, j] = mergeFromRight(leftKey, rightKey, mergedComponents[w][z]);

                delete leftIndex[leftKey];
                delete rightIndex[rightKey];

                rightIndex[getKey(text, mergedComponents[i][j], true)] = [i, j];
                mergedComponents[w][z] = null;
            } else if (leftKey in rightIndex) {
                // found mergeable line adjacent to the start of the current line, merge
                mergeFromRight(leftKey, rightKey, comp);
            } else if (rightKey in leftIndex) {
                // found mergeable line adjacent to the end of the current line, merge
                mergeFromLeft(leftKey, rightKey, comp);
            } else {
                // no adjacent lines, add as a new item
                const featureComponents = mergedComponents[k] || {};
                featureComponents[c] = comp;
                leftIndex[leftKey] = [k, c];
                rightIndex[rightKey] = [k, c];
                mergedComponents[k] = featureComponents;
            }
        }
    }

    return [
        ...noTextFeatures,
        ...Object.keys(mergedComponents)
            // filter out features with empty geometry
            .map(featureIdx => {
                const mergedGeometry = Object.values(mergedComponents[+featureIdx]).filter(component => component !== null);
                const feature = features[+featureIdx];
                feature.geometry = mergedGeometry;
                return mergedGeometry.length > 0 ? feature : null;
            })
            .filter(feature => feature !== null)
    ];
}
