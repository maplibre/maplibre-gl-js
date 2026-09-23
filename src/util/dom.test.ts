import {describe, expect, test} from 'vitest';
import {DOM} from './dom.ts';

function sanitizeToHTML(input: string): string {
    const container = document.createElement('div');
    container.append(DOM.sanitize(input));
    return container.innerHTML;
}

describe('DOM', () => {

    describe('sanitize', () => {
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
            expect(output).toBe('<object>x</object>');
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
    });
});
