import {getGlobalWorkerPool, restartWorkers} from './global_worker_pool.ts';
import {getGlobalDispatcher} from './global_dispatcher.ts';
import {MessageType} from './actor_messages.ts';

/** How long the workers get to answer a ping before they are considered terminated. */
export const WORKER_PING_TIMEOUT_MS = 2000;

let watchingWorkerHealth = false;
let healthCheckInFlight = false;

/**
 * Checks worker health on every return to the foreground, restarting the workers if the browser
 * terminated them while the page was hidden, as iOS does under memory pressure. Browsers fire no
 * event for the termination, so the health check is the only way to notice it.
 */
export function watchWorkerHealth(): void {
    if (watchingWorkerHealth || typeof document === 'undefined') return;
    watchingWorkerHealth = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') restartWorkersIfTerminated();
    }, false);
}

/**
 * Restarts the shared workers unless every one answers a ping in time. Any answer, even an
 * error, proves the worker is alive; only silence means the browser terminated it.
 */
export async function restartWorkersIfTerminated(timeoutMs: number = WORKER_PING_TIMEOUT_MS): Promise<void> {
    if (healthCheckInFlight || !getGlobalWorkerPool().workersPromise) return;
    healthCheckInFlight = true;
    try {
        const alive = await Promise.race([
            getGlobalDispatcher().broadcast(MessageType.ping, undefined).then(() => true, () => true),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
        ]);
        if (!alive) restartWorkers();
    } finally {
        healthCheckInFlight = false;
    }
}
