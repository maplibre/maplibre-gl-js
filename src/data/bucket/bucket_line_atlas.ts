import type {DashEntry} from '../../render/line_atlas';
import type {GetDashesResponse} from '../../util/actor_messages';

export function createBucketLineAtlas(buckets: {[_: string]: any}, dashes: GetDashesResponse): {[_: string]: DashEntry} {
    return dashes;
}
