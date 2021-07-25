import mapboxgl from '../../';

import type {WorkerInterface} from '../web_worker';

export default function(): WorkerInterface {
    return new Worker(mapboxgl.workerUrl) as any;
}
