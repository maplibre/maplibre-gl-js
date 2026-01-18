import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import {Map} from '../map';
import {beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map cross-window support', () => {

    describe('iframe cross-window scenario', () => {
        let iframe: HTMLIFrameElement;
        let iframeDocument: Document;
        let iframeWindow: Window;
        let container: HTMLDivElement;

        beforeEach(() => {
            // Create an iframe to simulate a cross-window scenario
            iframe = window.document.createElement('iframe');
            window.document.body.appendChild(iframe);
            
            iframeDocument = iframe.contentDocument;
            iframeWindow = iframe.contentWindow;

            // Create container in iframe's document
            container = iframeDocument.createElement('div');
            iframeDocument.body.appendChild(container);
            Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
            Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});
        });

        afterEach(() => {
            if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        });

        test('container from iframe works with Map', () => {
            // Verify we have a different window/document context
            expect(iframeDocument).not.toBe(window.document);
            expect(iframeWindow).not.toBe(window);

            // Demonstrate the cross-window instanceof issue
            // Container created in iframe is NOT an instanceof main window's HTMLElement
            expect(container instanceof HTMLElement).toBe(false);
            expect(container instanceof iframeDocument.defaultView.HTMLElement).toBe(true);

            // Map initialize should still work
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

            // Map should be created successfully
            expect(map).toBeTruthy();
            expect(map.getContainer()).toBe(container);

            // Map._ownerWindow should return the iframe's window
            expect(map._ownerWindow).toBe(iframeWindow);

            // HandlerManager should also use the iframe's window/document
            const handlers = map.handlers;
            expect(handlers._ownerWindow).toBe(iframeWindow);
            expect(handlers._ownerDocument).toBe(iframeDocument);

            // Basic map operations should work
            map.setCenter([10, 20]);
            expect(map.getCenter().lng).toBeCloseTo(10);
            expect(map.getCenter().lat).toBeCloseTo(20);

            map.setZoom(5);
            expect(map.getZoom()).toBe(5);

            map.jumpTo({center: [30, 40], zoom: 8});
            expect(map.getCenter().lng).toBeCloseTo(30);
            expect(map.getCenter().lat).toBeCloseTo(40);
            expect(map.getZoom()).toBe(8);
        });
    });

});
