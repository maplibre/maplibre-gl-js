import {afterEach, describe, expect, test} from 'vitest';
import {DOM} from './dom.ts';

function sanitizeToHTML(input: string): string {
    const container = document.createElement('div');
    container.append(DOM.sanitize(input));
    return container.innerHTML;
}

describe('DOM', () => {

    describe('sanitize', () => {
        // A named form control shadows the same-named property of its own form element in a browser, so markup can
        // choose what `form.remove` or `form.localName` resolve to. jsdom does not implement that
        // (`[LegacyOverrideBuiltIns]`), so the emulation below is what makes the tests using it fail against a
        // sanitizer that reads those off the element rather than off `Element.prototype`.
        const clobberedProperties: string[] = [];

        function clobberFormProperty(property: string) {
            clobberedProperties.push(property);
            const inherited = Object.getOwnPropertyDescriptor(Element.prototype, property);
            Object.defineProperty(HTMLFormElement.prototype, property, {
                configurable: true,
                get(this: HTMLFormElement) {
                    const named = Element.prototype.querySelectorAll.call(this, `[name="${property}"]`);
                    if (named.length === 0) return inherited.get ? inherited.get.call(this) : inherited.value;
                    return named.length === 1 ? named[0] : named;
                }
            });
        }

        afterEach(() => {
            for (const property of clobberedProperties) delete HTMLFormElement.prototype[property];
            clobberedProperties.length = 0;
        });

        test('should not fail on empty string', () => {
            const input = '';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove script tags', () => {
            const input = '<script>alert(\'hi\')</script>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove script tags from nested elements', () => {
            const input = '<div><script>alert(\'hi\')</script></div>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<div></div>');
        });

        test('should remove potentially dangerous attributes', () => {
            const input = '<a href=\'javascript:alert(1)\'>click me</a>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a>click me</a>');
        });

        test('should remove potentially dangerous attributes from img', () => {
            const input = '<img onerror=\'javascript:alert(1)\'>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<img>');
        });

        test('should remove potentially dangerous attributes from nested elements', () => {
            const input = '<div><a href=\'javascript:alert(1)\'>click me</a></div>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<div><a>click me</a></div>');
        });

        test('should remove multiple consecutive dangerous attributes', () => {
            const input = '<details open onload="1" ontoggle="alert(1)">x</details>';
            const output = sanitizeToHTML(input);
            expect(output).not.toContain('onload');
            expect(output).not.toContain('ontoggle');
        });

        test('should remove iframe tags', () => {
            const input = '<iframe src=\'https://example.com\'></iframe>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove iframe tags from nested elements', () => {
            const input = '<div><iframe srcdoc=\'<script>alert(1)</script>\'></iframe></div>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<div></div>');
        });

        test('should remove srcdoc attributes', () => {
            const input = '<object srcdoc=\'<script>alert(1)</script>\'>x</object>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove dangerous attributes that follow a removed attribute', () => {
            const input = '<a href=\'javascript:alert(1)\' onclick=\'alert(1)\'>click me</a>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a>click me</a>');
        });

        test('should not let mutated markup reintroduce dangerous attributes', () => {
            const input = '<form><math><mtext></form><form><mglyph><style></math><img src onerror="alert(1)">';
            expect(DOM.sanitize(input).querySelector('[onerror]')).toBeNull();
        });

        test('should keep the markup an attribution actually needs', () => {
            const input = '<a href="https://maplibre.org/" target="_blank" rel="noopener" class="link" title="MapLibre">&copy; <b>MapLibre</b></a>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a href="https://maplibre.org/" target="_blank" rel="noopener" class="link" title="MapLibre">© <b>MapLibre</b></a>');
        });

        test('should keep relative and mailto links', () => {
            const input = '<a href="/about">about</a><a href="mailto:x@example.com">mail</a><img src="logo.png" alt="logo">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a href="/about">about</a><a href="mailto:x@example.com">mail</a><img src="logo.png" alt="logo">');
        });

        test('should remove elements that are not on the allow list', () => {
            const input = '<div>kept<center>dropped</center></div>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<div>kept</div>');
        });

        test('should remove object and embed tags that can frame remote content', () => {
            const input = '<object data="https://example.com/x.html">x</object><embed src="https://example.com/x.html">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove meta tags that would navigate the page away', () => {
            const input = 'x<meta http-equiv="refresh" content="0;url=https://example.com">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('x');
        });

        test('should remove base tags that would change how relative urls resolve', () => {
            const input = 'x<base href="https://example.com/">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('x');
        });

        test('should remove style and link tags that would restyle the whole page', () => {
            const input = 'x<style>body{display:none}</style><link rel="stylesheet" href="https://example.com/x.css">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('x');
        });

        test('should remove form tags that could phish for credentials', () => {
            const input = '<form action="https://example.com/steal" method="post"><input name="password" type="password"></form>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove template tags whose contents are never reachable for cleaning', () => {
            const input = 'x<template><img src="y" onerror="alert(1)"></template>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('x');
        });

        test('should remove svg and math tags whose parsing rules differ from html', () => {
            const input = '<svg><a xlink:href="javascript:alert(1)"><text>click me</text></a></svg><math><mtext>x</mtext></math>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('');
        });

        test('should remove the style attribute that could cover the page with an overlay', () => {
            const input = '<div style="position:fixed;inset:0;z-index:99999">x</div>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<div>x</div>');
        });

        test('should remove javascript urls hidden behind whitespace and control characters', () => {
            const input = '<a href="  jav&#x09;ascri&#x0A;pt:alert(1)">click me</a>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a>click me</a>');
        });

        test('should keep aria attributes', () => {
            const input = '<a href="https://maplibre.org/" aria-label="MapLibre" aria-hidden="false">MapLibre</a>';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a href="https://maplibre.org/" aria-label="MapLibre" aria-hidden="false">MapLibre</a>');
        });

        test('should remove urls that cannot be parsed', () => {
            const input = '<a href="http://">click me</a><img src="https://%">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<a>click me</a><img>');
        });

        test('should remove data urls', () => {
            const input = '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">';
            const output = sanitizeToHTML(input);
            expect(output).toBe('<img>');
        });

        test('should remove a form whose named control shadows remove', () => {
            clobberFormProperty('remove');
            const input = '<form onclick="alert(1)"><input name="remove"></form>';
            expect(sanitizeToHTML(input)).toBe('');
        });

        test('should remove a form whose named control shadows localName', () => {
            clobberFormProperty('localName');
            const input = '<form onclick="alert(1)"><input name="localName"></form>';
            expect(sanitizeToHTML(input)).toBe('');
        });

        test('should remove a form whose named controls shadow the whole traversal', () => {
            for (const property of ['remove', 'localName', 'namespaceURI', 'children', 'attributes', 'querySelectorAll']) {
                clobberFormProperty(property);
            }
            const input = '<div><form onclick="alert(1)"><input name="remove"><input name="localName"><input name="namespaceURI"><input name="children"><input name="attributes"><input name="querySelectorAll"><img src="x" onerror="alert(1)"></form></div>';
            expect(sanitizeToHTML(input)).toBe('<div></div>');
        });
    });
});
