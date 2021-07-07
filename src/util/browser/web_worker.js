// @flow

import window from '../window.js';
import mapboxgl from '../../index.js';

import type {WorkerInterface} from '../web_worker.js';

export default function (): WorkerInterface {
    return (new window.Worker(mapboxgl.workerUrl): any);
}
