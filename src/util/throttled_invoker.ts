/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called.
 * Invocation requests are ignored until the function was actually invoked.
 */
export class ThrottledInvoker {
    _channel: MessageChannel;
    _triggered: boolean;
    _methodToThrottle: Function;

    constructor(methodToThrottle: Function) {
        this._methodToThrottle = methodToThrottle;
        this._triggered = false;
        if (typeof MessageChannel !== 'undefined') {
            this._channel = new MessageChannel();
            this._channel.port2.onmessage = () => {
                this._triggered = false;
                this._methodToThrottle();
            };
        }
    }

    trigger() {
        if (this._triggered) {
            return;
        }
        this._triggered = true;
        if (this._channel) {
            this._channel.port1.postMessage(true);
        } else {
            setTimeout(() => {
                this._triggered = false;
                this._methodToThrottle();
            }, 0);
        }
    }

    remove() {
        delete this._channel;
        this._methodToThrottle = () => {};
    }
}
