
import deref from '../deref';
import type {StyleSpecification} from '../types.g';

function eachLayer(style, callback) {
    for (const k in style.layers) {
        callback(style.layers[k]);
    }
}

export default function migrateV9(style: StyleSpecification): StyleSpecification {
    (style.version as any) = 9;

    // remove user-specified refs
    style.layers = deref(style.layers);

    // remove class-specific paint properties
    eachLayer(style, (layer) => {
        for (const k in layer) {
            if (/paint\..*/.test(k)) {
                delete layer[k];
            }
        }
    });

    return style;
}
