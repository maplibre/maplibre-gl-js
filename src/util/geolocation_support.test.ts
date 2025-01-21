import {describe, beforeEach, test, expect, vi} from 'vitest';
import {checkGeolocationSupport} from './geolocation_support';

describe('checkGeolocationSupport', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('it should return false if geolocation is not defined', async () => {
        await expect(checkGeolocationSupport()).resolves.toBeFalsy();
    });

    test('it should return the cached value on second call', async () => {
        const returnValue = await checkGeolocationSupport();
        expect(returnValue).toBeFalsy();
        (window.navigator as any).geolocation = {};
        const rv = await checkGeolocationSupport();
        expect(rv).toBe(returnValue);
    });

    test('it should return the true if geolocation is defined', async () => {
        (window.navigator as any).geolocation = {};
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeTruthy();
    });

    test('it should check permissions if possible', async () => {
        (window.navigator as any).geolocation = {};
        (window.navigator as any).permissions = {
            query: () => Promise.resolve({state: 'granted'})
        };
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeTruthy();
    });

    test('it should check permissions and geolocation for iOS 16 promise rejection', async () => {
        (window.navigator as any).geolocation = undefined;
        (window.navigator as any).permissions = {
            query: () => Promise.reject(new Error('perissions error'))
        };
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeFalsy();
    });
});
