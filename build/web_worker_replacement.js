import maplibregl from '../rollup/build/tsc/src/index'

export default function () {
    return new Worker(maplibregl.workerUrl);
}