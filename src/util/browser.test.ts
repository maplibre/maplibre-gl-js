import {browser} from './browser';

describe('browser', () => {
    test('frameAsync', async () => {
        const id = await browser.frameAsync(new AbortController());
        expect(id).toBeTruthy();
    });

    test('now', () => {
        expect(typeof browser.now()).toBe('number');
    });

    test('frameAsync', async () => {
        const abortController = new AbortController();
        const promise = browser.frameAsync(abortController);
        abortController.abort();
        await expect(promise).rejects.toThrow();
    });

    test('hardwareConcurrency', () => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
    });
});
