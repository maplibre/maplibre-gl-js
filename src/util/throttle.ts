/**
 * Throttle the given function to run at most every `period` milliseconds.
 * @private
 */
export default function throttle(fn: () => void, time: number): () => ReturnType<typeof setTimeout> {
    let pending = false;
    let timerId: ReturnType<typeof setTimeout> = null;

    const later = () => {
        timerId = null;
        if (pending) {
            fn();
            timerId = setTimeout(later, time);
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
