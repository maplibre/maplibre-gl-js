import type {ImagePositionLike} from '../../render/image_atlas';
import type {GetDashesResponse} from '../../util/actor_messages';

export function createBucketLineAtlas(buckets: {[_: string]: any;}, dashes: GetDashesResponse): {[_: string]: ImagePositionLike;} {
    const dasharrayPositions: {[_: string]: ImagePositionLike;} = {};

    for (const key in buckets) {
        const bucket = buckets[key];
        if (bucket.hasPattern && bucket.patternFeatures) {
            for (const patternFeature of bucket.patternFeatures) {
                for (const layer of bucket.layers) {
                    const dasharrayPattern = patternFeature.dashes[layer.id];

                    if (dasharrayPattern) {
                        const {min: minKey, mid: midKey, max: maxKey} = dasharrayPattern;

                        const dashMin = dashes[minKey];
                        const dashMid = dashes[midKey];
                        const dashMax = dashes[maxKey];

                        if (dashMin && dashMid && dashMax) {
                            dasharrayPositions[minKey] = {tlbr: [0, dashMin.y, dashMin.height, dashMin.width], pixelRatio: 1};
                            dasharrayPositions[midKey] = {tlbr: [0, dashMid.y, dashMid.height, dashMid.width], pixelRatio: 1};
                            dasharrayPositions[maxKey] = {tlbr: [0, dashMax.y, dashMax.height, dashMax.width], pixelRatio: 1};
                        }
                    }
                }
            }
        }
    }

    return dasharrayPositions;
}
