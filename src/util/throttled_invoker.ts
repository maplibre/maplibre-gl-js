/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called.
 * Invocation requests are ignored until the function was actually invoked.
 * A timer backs up the message, since WebKit can close the message ports (#8780).
 */
export class ThrottledInvoker {
    _channel: MessageChannel | undefined;
    _triggered: boolean;
    _methodToThrottle: Function;

    constructor(methodToThrottle: Function) {
        this._methodToThrottle = methodToThrottle;
        this._triggered = false;
        this._channel = new MessageChannel();
        this._channel.port2.onmessage = () => this._invoke();
    }

    trigger(): void {
        if (this._triggered) {
            return;
        }
        this._triggered = true;
        this._channel?.port1.postMessage(true);
        setTimeout(() => this._invoke(), 0);
    }

    _invoke(): void {
        if (!this._triggered) {
            return;
        }
        this._triggered = false;
        this._methodToThrottle();
    }

    remove(): void {
        delete this._channel;
        this._methodToThrottle = () => {};
    }
}
