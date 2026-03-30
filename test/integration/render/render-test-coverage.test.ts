import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import spec from '@maplibre/maplibre-gl-style-spec/src/reference/v8.json';

const RENDER_TESTS_DIR = path.resolve(__dirname, 'tests');

type ExpressionCapability = 'constant' | 'zoom' | 'data-driven' | 'feature-state';

interface SpecProperty {
    layerType: string;
    group: 'layout' | 'paint';
    name: string;
    capability: ExpressionCapability;
    type: string;
}

const LAYER_TYPES = ['fill', 'line', 'circle', 'symbol', 'raster', 'hillshade', 'heatmap', 'background', 'fill-extrusion'];

function getSubdirectories(dir: string): string[] {
    try {
        return fs.readdirSync(dir, {withFileTypes: true})
            .filter(d => d.isDirectory())
            .map(d => d.name);
    } catch {
        return [];
    }
}

/**
 * Scan all style.json files under render tests to build a reverse map:
 * propertyName → Set<testDirName>
 */
function buildPropertyToCoverageDirs(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const testDir of getSubdirectories(RENDER_TESTS_DIR)) {
        const testDirPath = path.join(RENDER_TESTS_DIR, testDir);
        for (const testCase of getSubdirectories(testDirPath)) {
            const styleJsonPath = path.join(testDirPath, testCase, 'style.json');
            if (!fs.existsSync(styleJsonPath)) continue;

            let style: any;
            try {
                style = JSON.parse(fs.readFileSync(styleJsonPath, 'utf8'));
            } catch {
                continue;
            }

            const layers = style?.layers;
            if (!Array.isArray(layers)) continue;

            for (const layer of layers) {
                for (const groupKey of ['paint', 'layout'] as const) {
                    const props = layer[groupKey];
                    if (!props || typeof props !== 'object') continue;
                    for (const propName of Object.keys(props)) {
                        if (!map.has(propName)) map.set(propName, new Set());
                        map.get(propName)!.add(testDir);
                    }
                }
            }
        }
    }

    return map;
}

/**
 * Detect deprecated/superseded properties from the spec.
 * A property is deprecated if its `requires` array contains {"!": "replacement"}
 * where `replacement` exists in the same property group.
 */
function isDeprecatedProperty(propName: string, groupProps: Record<string, any>): boolean {
    const def = groupProps[propName];
    if (!def?.requires) return false;

    return def.requires.some((req: any) => {
        if (typeof req === 'object' && '!' in req) {
            const replacement = req['!'];
            return replacement in groupProps;
        }
        return false;
    });
}

/**
 * Detect temporal/animation properties that can't be render-tested.
 */
function isTemporalProperty(def: any): boolean {
    return def?.units === 'milliseconds';
}

function getCapability(def: any): ExpressionCapability {
    const propertyType: string = def['property-type'] ?? 'constant';
    const params: string[] = def.expression?.parameters ?? [];

    // feature-state is only detectable from expression parameters
    if (params.includes('feature-state')) return 'feature-state';

    if (propertyType === 'data-driven' || propertyType === 'cross-faded-data-driven') {
        return 'data-driven';
    }

    if (propertyType === 'data-constant' || propertyType === 'cross-faded' || propertyType === 'color-ramp') {
        if (params.includes('zoom')) return 'zoom';
    }

    return 'constant';
}

function getSpecProperties(): SpecProperty[] {
    const properties: SpecProperty[] = [];

    for (const lt of LAYER_TYPES) {
        for (const group of ['layout', 'paint'] as const) {
            const key = `${group}_${lt.replaceAll('-', '_')}`;
            const props = (spec as any)[key];
            if (!props) continue;

            for (const [name, def] of Object.entries(props) as [string, any][]) {
                if (name === 'visibility') continue;
                if (isDeprecatedProperty(name, props)) continue;
                if (isTemporalProperty(def)) continue;

                properties.push({
                    layerType: lt,
                    group,
                    name,
                    capability: getCapability(def),
                    type: def.type,
                });
            }
        }
    }

    return properties;
}

const propertyCoverageDirs = buildPropertyToCoverageDirs();
const specProperties = getSpecProperties();
const renderTestDirs = new Set(getSubdirectories(RENDER_TESTS_DIR));

/**
 * Returns the set of test directories that cover a given property,
 * found by scanning style.json files.
 */
function testDirsFor(prop: SpecProperty): Set<string> {
    return propertyCoverageDirs.get(prop.name) ?? new Set();
}

function hasCoverage(prop: SpecProperty): boolean {
    const dirs = testDirsFor(prop);
    // Property is covered if any of its test dirs exist in the render tests
    return [...dirs].some(d => renderTestDirs.has(d));
}

function testCasesFor(prop: SpecProperty): string[] {
    const dirs = testDirsFor(prop);
    const cases: string[] = [];
    for (const dir of dirs) {
        if (renderTestDirs.has(dir)) {
            cases.push(...getSubdirectories(path.join(RENDER_TESTS_DIR, dir)));
        }
    }
    return cases;
}

function hasMatchingCase(cases: string[], patterns: string[], exact = false): boolean {
    return cases.some(c => patterns.some(p => exact ? c === p : c.includes(p)));
}

describe('Render test coverage vs style spec', () => {
    const propsWithoutTestDir = specProperties.filter(p => !hasCoverage(p));

    test.each(
        propsWithoutTestDir.map(p => [`${p.layerType} ${p.group} ${p.name}`, p] as const)
    )('%s should have a render test directory', (_, prop) => {
        expect.unreachable(`No render test directory for "${prop.name}" (${prop.capability})`);
    });

    if (propsWithoutTestDir.length === 0) {
        test('all spec properties have a render test directory', () => {});
    }

    const dataDrivenPatterns = ['property-function', 'data-driven', 'data-expression', 'databind', 'composite-function', 'composite-expression'];
    const dataDrivenProps = specProperties.filter(p =>
        (p.capability === 'data-driven' || p.capability === 'feature-state') && hasCoverage(p)
    );

    test.each(
        dataDrivenProps.map(p => [`${p.layerType} ${p.group} ${p.name}`, p] as const)
    )('%s should have a data-driven test case', (_, prop) => {
        const cases = testCasesFor(prop);
        expect(hasMatchingCase(cases, dataDrivenPatterns),
            `"${prop.name}" has cases [${cases.join(', ')}] but none match data-driven patterns`
        ).toBe(true);
    });

    const zoomPatterns = ['function', 'zoom', 'camera-function', 'zoom-function', 'zoom-expression', 'step-curve'];
    const zoomCapableProps = specProperties.filter(p =>
        p.capability !== 'constant' && hasCoverage(p)
    );

    test.each(
        zoomCapableProps.map(p => [`${p.layerType} ${p.group} ${p.name}`, p] as const)
    )('%s should have a zoom function test case', (_, prop) => {
        const cases = testCasesFor(prop);
        expect(hasMatchingCase(cases, zoomPatterns),
            `"${prop.name}" has cases [${cases.join(', ')}] but none match zoom patterns`
        ).toBe(true);
    });

    const basePatterns = ['default', 'literal', 'basic'];
    const propsWithTestDir = specProperties.filter(p => hasCoverage(p));

    test.each(
        propsWithTestDir.map(p => [`${p.layerType} ${p.group} ${p.name}`, p] as const)
    )('%s should have a default/literal baseline test', (_, prop) => {
        const cases = testCasesFor(prop);
        expect(hasMatchingCase(cases, basePatterns, true),
            `"${prop.name}" has cases [${cases.join(', ')}] but none are default/literal/basic`
        ).toBe(true);
    });

    const featureStateProps = specProperties.filter(p =>
        p.capability === 'feature-state' && hasCoverage(p)
    );

    test.each(
        featureStateProps.map(p => [`${p.layerType} ${p.group} ${p.name}`, p] as const)
    )('%s should have a feature-state test case', (_, prop) => {
        const cases = testCasesFor(prop);
        expect(hasMatchingCase(cases, ['feature-state', 'global-state']),
            `"${prop.name}" has cases [${cases.join(', ')}] but none match feature-state patterns`
        ).toBe(true);
    });
});
