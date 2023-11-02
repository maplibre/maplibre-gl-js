import {isWorker} from './util';
import {serialize, deserialize, Serialized} from './web_worker_transfer';
import {ThrottledInvoker} from './throttled_invoker';

import type {Transferable} from '../types/transferable';
import type {Cancelable} from '../types/cancelable';
import type {AsyncMessage, MessageType, RequestResponseMessageMap} from './actor_messages';

/**
 * An interface to be sent to the actor in order for it to allow communication between the worker and the main thread
 */
export interface ActorTarget {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
    postMessage: typeof window.postMessage;
    terminate?: () => void;
}

export type MessageData = {
    id: string;
    type: MessageType | '<cancel>' | '<response>';
    data?: Serialized;
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    error?: Serialized | null;
    hasCallback?: boolean;
    sourceMapId: string | number | null;
}

export type Message = {
    data: MessageData;
}

/**
 * This interface allowing to substitute only the sendAsync method of the Actor class.
 */
export interface IActor {
    sendAsync<T extends MessageType>(message: AsyncMessage<T>, abortController?: AbortController): Promise<RequestResponseMessageMap[T][1]>;
}

export type MessageHandler<T extends MessageType> = (mapId: string | number, params: RequestResponseMessageMap[T][0], abortController?: AbortController) => Promise<RequestResponseMessageMap[T][1]>

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 */
export class Actor implements IActor {
    target: ActorTarget;
    mapId: string | number | null;
    callbacks: { [x: number]: Function};
    name: string;
    tasks: { [x: number]: MessageData };
    taskQueue: Array<string>;
    abortControllers: { [x: number | string]: AbortController };
    invoker: ThrottledInvoker;
    globalScope: ActorTarget;
    messageHandlers: { [x in MessageType]?: MessageHandler<MessageType>};

    /**
     * @param target - The target
     * @param parent - The parent
     * @param mapId - A unique identifier for the Map instance using this Actor.
     */
    constructor(target: ActorTarget, mapId?: string | number) {
        this.target = target;
        this.mapId = mapId;
        this.callbacks = {};
        this.tasks = {};
        this.taskQueue = [];
        this.abortControllers = {};
        this.messageHandlers = {};
        this.invoker = new ThrottledInvoker(this.process);
        this.target.addEventListener('message', this.receive, false);
        this.globalScope = isWorker(self) ? target : window;
    }

    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>) {
        this.messageHandlers[type] = handler;
    }

    sendAsync<T extends MessageType>(message: AsyncMessage<T>, abortController?: AbortController): Promise<RequestResponseMessageMap[T][1]> {
        return new Promise((resolve, reject) => {
            const cancelable = this._send(message.type, message.data, (err: Error, data: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, message.targetMapId, message.mustQueue);
            if (abortController) {
                abortController.signal.addEventListener('abort', () => {
                    cancelable.cancel();
                    // In case of abort the current behavior is to keep the promise pending.
                }, {once: true});
            }
        });
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to
     * a main-thread map instance.
     *
     * @param type - The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
     * @param targetMapId - A particular mapId to which to send this message.
     */
    _send<T extends MessageType>(
        type: T,
        data: RequestResponseMessageMap[T][0],
        callback?: Function | null,
        targetMapId?: string | number | null,
        mustQueue: boolean = false
    ): Cancelable {
        // We're using a string ID instead of numbers because they are being used as object keys
        // anyway, and thus stringified implicitly. We use random IDs because an actor may receive
        // message from multiple other actors which could run in different execution context. A
        // linearly increasing ID could produce collisions.
        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
        if (callback) {
            this.callbacks[id] = callback;
        }
        const buffers: Array<Transferable> = [];
        const message: MessageData = {
            id,
            type,
            hasCallback: !!callback,
            targetMapId,
            mustQueue,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        };
        this.target.postMessage(message, {transfer: buffers});
        return {
            cancel: () => {
                if (callback) {
                    // Set the callback to null so that it never fires after the request is aborted.
                    delete this.callbacks[id];
                }
                const cancelMessage: MessageData = {
                    id,
                    type: '<cancel>',
                    targetMapId,
                    sourceMapId: this.mapId
                };
                this.target.postMessage(cancelMessage);
            }
        };
    }

    receive = (message: Message) => {
        const data = message.data;
        const id = data.id;

        if (!id) {
            return;
        }

        if (data.targetMapId && this.mapId !== data.targetMapId) {
            return;
        }
        if (data.type === '<cancel>') {
            // Remove the original request from the queue. This is only possible if it
            // hasn't been kicked off yet. The id will remain in the queue, but because
            // there is no associated task, it will be dropped once it's time to execute it.
            delete this.tasks[id];
            const abortController = this.abortControllers[id];
            delete this.abortControllers[id];
            if (abortController) {
                abortController.abort();
            }
            return;
        }
        if (isWorker(self) || data.mustQueue) {
            // In workers, store the tasks that we need to process before actually processing them. This
            // is necessary because we want to keep receiving messages, and in particular,
            // <cancel> messages. Some tasks may take a while in the worker thread, so before
            // executing the next task in our queue, postMessage preempts this and <cancel>
            // messages can be processed. We're using a MessageChannel object to get throttle the
            // process() flow to one at a time.
            this.tasks[id] = data;
            this.taskQueue.push(id);
            this.invoker.trigger();
            return;
        }
        // In the main thread, process messages immediately so that other work does not slip in
        // between getting partial data back from workers.
        this.processTask(id, data);
    };

    process = () => {
        if (this.taskQueue.length === 0) {
            return;
        }
        const id = this.taskQueue.shift();
        const task = this.tasks[id];
        delete this.tasks[id];
        // Schedule another process call if we know there's more to process _before_ invoking the
        // current task. This is necessary so that processing continues even if the current task
        // doesn't execute successfully.
        if (this.taskQueue.length > 0) {
            this.invoker.trigger();
        }
        if (!task) {
            // If the task ID doesn't have associated task data anymore, it was canceled.
            return;
        }

        this.processTask(id, task);
    };

    async processTask(id: string, task: MessageData) {
        if (task.type === '<response>') {
            // The `completeTask` function in the counterpart actor has been called, and we are now
            // firing the callback in the originating actor, if there is one.
            const callback = this.callbacks[id];
            delete this.callbacks[id];
            if (!callback) {
                // If we get a response, but don't have a callback, the request was canceled.
                return;
            }
            if (task.error) {
                callback(deserialize(task.error));
            } else {
                callback(null, deserialize(task.data));
            }
            return;
        }
        if (!this.messageHandlers[task.type]) {
            this.completeTask(task, id, new Error(`Could not find a registered handler for ${task.type}`));
            return;
        }
        const params = deserialize(task.data) as any;
        const abortController = new AbortController();
        this.abortControllers[id] = abortController;
        try {
            const data = await this.messageHandlers[task.type](task.sourceMapId, params, abortController);
            this.completeTask(task, id, null, data);
        } catch (err) {
            this.completeTask(task, id, err);
        }
    }

    completeTask(task: MessageData, id: string, err: Error, data?: any) {
        if (!task.hasCallback) {
            return;
        }
        const buffers: Array<Transferable> = [];
        delete this.abortControllers[id];
        const responseMessage: MessageData = {
            id,
            type: '<response>',
            sourceMapId: this.mapId,
            error: err ? serialize(err) : null,
            data: serialize(data, buffers)
        };
        this.target.postMessage(responseMessage, {transfer: buffers});
    }

    remove() {
        this.invoker.remove();
        this.target.removeEventListener('message', this.receive, false);
    }
}
