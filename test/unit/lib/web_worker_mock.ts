import MapLibreWorker from '../../../src/source/worker.ts';
import type {WorkerGlobalScopeInterface} from '../../../src/util/web_worker.ts';
import type {ActorTarget} from '../../../src/util/actor.ts';

export class MessageBus implements WorkerGlobalScopeInterface, ActorTarget {
    addListeners: EventListener[];
    postListeners: EventListener[];
    target: MessageBus;
    eventListeners: Record<string, EventListener[]>;

    registerWorkerSource: any;
    registerRTLTextPlugin: any;
    addProtocol: any;
    removeProtocol: any;
    makeRequest: any;
    worker: any;

    constructor(addListeners: EventListener[], postListeners: EventListener[]) {
        this.addListeners = addListeners;
        this.postListeners = postListeners;
        this.eventListeners = {message: addListeners};
    }

    addEventListener(event: string, callback: EventListener): void {
        this.eventListeners[event] ||= [];
        this.eventListeners[event].push(callback);
    }

    removeEventListener(event: string, callback: EventListener): void {
        const listeners = this.eventListeners[event] || [];
        const i = listeners.indexOf(callback);
        if (i >= 0) {
            listeners.splice(i, 1);
        }
    }

    dispatchEvent(event: Event): boolean {
        for (const listener of this.eventListeners[event.type] || []) {
            listener(event);
        }
        return true;
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
        for (const listeners of Object.values(this.eventListeners)) {
            listeners.splice(0, listeners.length);
        }
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
