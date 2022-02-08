import maplibregl from '../src/index';

export default function () {
    return new Worker(maplibregl.workerUrl);
}
