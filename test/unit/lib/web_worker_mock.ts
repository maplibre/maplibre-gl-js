import MapLibreWorker from '../../../src/source/worker.ts';
import type {WorkerGlobalScopeInterface} from '../../../src/util/web_worker.ts';
import type {ActorTarget} from '../../../src/util/actor.ts';

export class MessageBus implements WorkerGlobalScopeInterface, ActorTarget {
    addListeners: EventListener[];
    postListeners: EventListener[];
    target: MessageBus;

    registerWorkerSource: any;
    registerRTLTextPlugin: any;
    addProtocol: any;
    removeProtocol: any;
    makeRequest: any;
    worker: any;

    constructor(addListeners: EventListener[], postListeners: EventListener[]) {
        this.addListeners = addListeners;
        this.postListeners = postListeners;
    }

    addEventListener(event: 'message', callback: EventListener): void {
        if (event === 'message') {
            this.addListeners.push(callback);
        }
    }

    removeEventListener(event: 'message', callback: EventListener): void {
        const i = this.addListeners.indexOf(callback);
        if (i >= 0) {
            this.addListeners.splice(i, 1);
        }
    }

    postMessage(data: unknown): void {
        setTimeout(() => {
            try {
                for (const listener of this.postListeners) {
                    listener({data, target: this.target} as any);
                }
            } catch {
                // this is used only in tests, ignoring.
            }
        }, 0);
    }

    terminate(): void {
        this.addListeners.splice(0, this.addListeners.length);
        this.postListeners.splice(0, this.postListeners.length);
    }

    importScripts(): void { }
}

function setGlobalWorker(MockWorker: { new(...args: any): any}) {
    (global as any).Worker = function Worker(_: string) {
        const parentListeners = [];
        const workerListeners = [];
        const parentBus = new MessageBus(workerListeners, parentListeners);
        const workerBus = new MessageBus(parentListeners, workerListeners);

        parentBus.target = workerBus;
        workerBus.target = parentBus;

        parentBus.worker = new MockWorker(workerBus);

        return parentBus;
    };
}

setGlobalWorker(MapLibreWorker);

