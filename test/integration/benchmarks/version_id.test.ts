import {describe, expect, test} from 'vitest';
import {benchmarkVersionId} from '../../bench/lib/version_id.ts';

describe('benchmarkVersionId', () => {
    test('tags the working-directory bundle, which loads from the page origin', () => {
        expect(benchmarkVersionId('main ca16843', 'http://localhost:9966', 'http://localhost:9966'))
            .toBe('main ca16843 (local)');
    });

    test('leaves published bundles untouched, so their display names still resolve', () => {
        expect(benchmarkVersionId('main ca16843', 'https://maplibre.org', 'http://localhost:9966'))
            .toBe('main ca16843');
        expect(benchmarkVersionId('v6.0.0', 'https://maplibre.org', 'http://localhost:9966'))
            .toBe('v6.0.0');
    });

    test('keeps a local build distinct from a published bundle built at the same commit', () => {
        const published = benchmarkVersionId('main ca16843', 'https://maplibre.org', 'http://localhost:9966');
        const local = benchmarkVersionId('main ca16843', 'http://localhost:9966', 'http://localhost:9966');
        expect(local).not.toBe(published);
    });
});
