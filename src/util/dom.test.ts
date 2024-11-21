import {describe, expect, test} from 'vitest';
import {DOM} from './dom';

describe('DOM', () => {

    describe('sanitize', () => {
        test('should not fail on empty string', () => {
            const input = '';
            const output = DOM.sanitize(input);
            expect(output).toBe('');
        });

        test('should remove script tags', () => {
            const input = '<script>alert(\'hi\')</script>';
            const output = DOM.sanitize(input);
            expect(output).toBe('');
        });

        test('should remove script tags from nested elements', () => {
            const input = '<div><script>alert(\'hi\')</script></div>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<div></div>');
        });

        test('should remove potentially dangerous attributes', () => {
            const input = '<a href=\'javascript:alert(1)\'>click me</a>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<a>click me</a>');
        });

        test('should remove potentially dangerous attributes from img', () => {
            const input = '<img onerror=\'javascript:alert(1)\'>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<img>');
        });

        test('should remove potentially dangerous attributes from nested elements', () => {
            const input = '<div><a href=\'javascript:alert(1)\'>click me</a></div>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<div><a>click me</a></div>');
        });
    });
});
