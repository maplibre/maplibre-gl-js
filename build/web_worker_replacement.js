import maplibregl from '../'

export default function () {
    return new Worker(maplibregl.workerUrl);
}