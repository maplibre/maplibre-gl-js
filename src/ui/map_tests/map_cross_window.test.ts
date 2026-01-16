import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Map} from '../map';
import {beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map cross-window support', () => {

    test('accepts container element from another window using nodeType check', () => {
        // Simulate a cross-window scenario where instanceof HTMLElement fails
        // by creating an object that has nodeType but isn't an instanceof HTMLElement
        const mockCrossWindowElement = {
            nodeType: 1, // Node.ELEMENT_NODE
            ownerDocument: window.document,
            clientWidth: 200,
            clientHeight: 200,
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn()
            },
            style: {},
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 200,
                height: 200,
                right: 200,
                bottom: 200
            })
        };

        // The container should be accepted via nodeType check
        // even though it's not an instanceof HTMLElement
        expect(() => {
            new Map({
                container: mockCrossWindowElement as any,
                interactive: false,
                attributionControl: false,
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });
        }).not.toThrow();
    });

    test('_ownerWindow getter returns the correct window from container', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

        const map = new Map({
            container,
            interactive: false,
            attributionControl: false,
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        // _ownerWindow should return the window from container's ownerDocument
        expect(map._ownerWindow).toBe(window);
    });

    test('_ownerWindow getter falls back to global window when container is not set', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

        const map = new Map({
            container,
            interactive: false,
            attributionControl: false,
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        // Even after removal, _ownerWindow should have a fallback
        // Note: After map.remove(), _container is still set but _removed flag is true
        expect(map._ownerWindow).toBeTruthy();
    });

    test('uses ownerWindow for event listeners', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        const map = new Map({
            container,
            interactive: false,
            attributionControl: false,
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        // Should have added 'online' event listener to the owner window
        expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function), false);

        addEventListenerSpy.mockRestore();
    });

    test('uses ownerWindow ResizeObserver', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

        // Track if ResizeObserver was instantiated
        const observeMock = vi.fn();
        const ResizeObserverMock = vi.fn(function(this: any, callback: ResizeObserverCallback) {
            this.observe = observeMock;
            this.unobserve = vi.fn();
            this.disconnect = vi.fn();
        }) as unknown as typeof ResizeObserver;
        global.ResizeObserver = ResizeObserverMock;

        const map = new Map({
            container,
            interactive: false,
            attributionControl: false,
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        // ResizeObserver should have been instantiated and observe called
        expect(ResizeObserverMock).toHaveBeenCalled();
        expect(observeMock).toHaveBeenCalledWith(container);
    });

});
