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
            iframe = window.document.createElement('iframe');
            window.document.body.appendChild(iframe);
            
            iframeDocument = iframe.contentDocument;
            iframeWindow = iframe.contentWindow;

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

        test('initializes with cross-window container', () => {
            expect(iframeDocument).not.toBe(window.document);
            expect(iframeWindow).not.toBe(window);

            expect(container instanceof HTMLElement).toBe(false);
            expect(container instanceof iframeDocument.defaultView.HTMLElement).toBe(true);

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

            expect(map).toBeTruthy();
            expect(map.getContainer()).toBe(container);
        });

        test('map operations work with cross-window container', () => {
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
