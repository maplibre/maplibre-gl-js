/**
 * Throttle the given function to run at most every `period` milliseconds.
 */
export function throttle(fn: () => void, time: number): () => ReturnType<Window['setTimeout']> {
    let pending = false;
    let timerId: ReturnType<Window['setTimeout']> = null;

    const later = () => {
        timerId = null;
        if (pending) {
            fn();
            timerId = window.setTimeout(later, time);
            pending = false;
        }
    };

    return () => {
        pending = true;
        if (!timerId) {
            later();
        }
        return timerId;
    };
}
