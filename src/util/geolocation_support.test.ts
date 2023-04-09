import {checkGeolocationSupport} from './geolocation_support';

describe('checkGeolocationSupport', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('it should return false if geolocation is not defined', done => {
        checkGeolocationSupport((returnValue: boolean) => {
            expect(returnValue).toBeFalsy();
            done();
        });
    });

    test('it should return the cached value on second call', done => {
        checkGeolocationSupport((returnValue) => {
            expect(returnValue).toBeFalsy();
            (window.navigator as any).geolocation = {};
            checkGeolocationSupport((rv) => {
                expect(rv).toBe(returnValue);
                done();
            });
        });
    });

    test('it should return the true if geolocation is defined', done => {
        (window.navigator as any).geolocation = {};
        checkGeolocationSupport((returnValue) => {
            expect(returnValue).toBeTruthy();
            done();
        }, true);
    });

    test('it should check permissions if possible', done => {
        (window.navigator as any).geolocation = {};
        (window.navigator as any).permissions = {
            query: () => Promise.resolve({state: 'granted'})
        };
        checkGeolocationSupport((returnValue) => {
            expect(returnValue).toBeTruthy();
            done();
        }, true);
    });

    test('it should check permissions and geolocation for iOS 16 promise rejection', done => {
        (window.navigator as any).geolocation = undefined;
        (window.navigator as any).permissions = {
            query: () => Promise.reject(new Error('pemissions error'))
        };
        checkGeolocationSupport((returnValue) => {
            expect(returnValue).toBeFalsy();
            done();
        }, true);
    });
});
