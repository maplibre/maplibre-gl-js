import {describe, test, expect, vi} from 'vitest';
import {ThrottledInvoker} from './throttled_invoker.ts';
import {sleep} from './test/util.ts';

describe('ThrottledInvoker', () => {
    test('invokes the method when the message port is closed', async () => {
        const method = vi.fn();
        const invoker = new ThrottledInvoker(method);
        invoker._channel.port1.close();

        invoker.trigger();
        await sleep(10);

        expect(method).toHaveBeenCalledTimes(1);
    });
});
