import {
    symbolLayoutAttributes,
    collisionVertexAttributes,
    collisionBoxLayout,
    dynamicLayoutAttributes,
} from './symbol_attributes';

import {SymbolLayoutArray,
    SymbolDynamicLayoutArray,
    SymbolOpacityArray,
    CollisionBoxLayoutArray,
    CollisionVertexArray,
    PlacedSymbolArray,
    SymbolInstanceArray,
    GlyphOffsetArray,
    SymbolLineVertexArray,
    TextAnchorOffsetArray
} from '../array_types.g';

import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray, LineIndexArray} from '../index_array_type';
import {transformText} from '../../symbol/transform_text';
import {mergeLines} from '../../symbol/merge_lines';
import {allowsVerticalWritingMode, stringContainsRTLText} from '../../util/script_detection';
import {WritingMode} from '../../symbol/shaping';
import {loadGeometry} from '../load_geometry';
import {toEvaluationFeature} from '../evaluation_feature';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
import {verticalizedCharacterMap} from '../../util/verticalize_punctuation';
import {type Anchor} from '../../symbol/anchor';
import {getSizeData, MAX_PACKED_SIZE} from '../../symbol/symbol_size';

import {register} from '../../util/web_worker_transfer';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {Formatted, ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import {rtlWorkerPlugin} from '../../source/rtl_text_plugin_worker';
import {getOverlapMode} from '../../style/style_layer/overlap_mode';
import type {CanonicalTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type {CollisionBoxArray, CollisionBox, SymbolInstance} from '../array_types.g';
import type {StructArray, StructArrayMember, ViewType} from '../../util/struct_array';
import type {SymbolStyleLayer} from '../../style/style_layer/symbol_style_layer';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type {SymbolQuad} from '../../symbol/quads';
import type {SizeData} from '../../symbol/symbol_size';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import {Color} from '@maplibre/maplibre-gl-style-spec';

export type SingleCollisionBox = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    anchorPointX: number;
    anchorPointY: number;
};

export type CollisionArrays = {
    textBox?: SingleCollisionBox;
    verticalTextBox?: SingleCollisionBox;
    iconBox?: SingleCollisionBox;
    verticalIconBox?: SingleCollisionBox;
    textFeatureIndex?: number;
    verticalTextFeatureIndex?: number;
    iconFeatureIndex?: number;
    verticalIconFeatureIndex?: number;
};

export type SymbolFeature = {
    sortKey: number | void;
    text: Formatted | void;
    icon: ResolvedImage;
    index: number;
    sourceLayerIndex: number;
    geometry: Array<Array<Point>>;
    properties: any;
    type: 'Unknown' | 'Point' | 'LineString' | 'Polygon';
    id?: any;
};

export type SortKeyRange = {
    sortKey: number;
    symbolInstanceStart: number;
    symbolInstanceEnd: number;
};

// Opacity arrays are frequently updated but don't contain a lot of information, so we pack them
// tight. Each Uint32 is actually four duplicate Uint8s for the four corners of a glyph
// 7 bits are for the current opacity, and the lowest bit is the target opacity

// actually defined in symbol_attributes.js
// const placementOpacityAttributes = [
//     { name: 'a_fade_opacity', components: 1, type: 'Uint32' }
// ];
const shaderOpacityAttributes = [
    {name: 'a_fade_opacity', components: 1, type: 'Uint8' as ViewType, offset: 0}
];

function addVertex(
    array: StructArray,
    anchorX: number,
    anchorY: number,
    ox: number,
    oy: number,
    tx: number,
    ty: number,
    sizeVertex: number,
    isSDF: boolean,
    pixelOffsetX: number,
    pixelOffsetY: number,
    minFontScaleX: number,
    minFontScaleY: number
) {
    const aSizeX = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[0])) : 0;
    const aSizeY = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[1])) : 0;
    array.emplaceBack(
        // a_pos_offset
        anchorX,
        anchorY,
        Math.round(ox * 32),
        Math.round(oy * 32),

        // a_data
        tx, // x coordinate of symbol on glyph atlas texture
        ty, // y coordinate of symbol on glyph atlas texture
        (aSizeX << 1) + (isSDF ? 1 : 0),
        aSizeY,
        pixelOffsetX * 16,
        pixelOffsetY * 16,
        minFontScaleX * 256,
        minFontScaleY * 256
    );
}

function addDynamicAttributes(dynamicLayoutVertexArray: StructArray, p: Point, angle: number) {
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}

function containsRTLText(formattedText: Formatted): boolean {
    for (const section of formattedText.sections) {
        if (stringContainsRTLText(section.text)) {
            return true;
        }
    }
    return false;
}

export class SymbolBuffers {
    layoutVertexArray: SymbolLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<SymbolStyleLayer>;
    segments: SegmentVector;

    dynamicLayoutVertexArray: SymbolDynamicLayoutArray;
    dynamicLayoutVertexBuffer: VertexBuffer;

    opacityVertexArray: SymbolOpacityArray;
    opacityVertexBuffer: VertexBuffer;
    hasVisibleVertices: boolean;

    collisionVertexArray: CollisionVertexArray;
    collisionVertexBuffer: VertexBuffer;

    placedSymbolArray: PlacedSymbolArray;

    constructor(programConfigurations: ProgramConfigurationSet<SymbolStyleLayer>) {
        this.layoutVertexArray = new SymbolLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = programConfigurations;
        this.segments = new SegmentVector();
        this.dynamicLayoutVertexArray = new SymbolDynamicLayoutArray();
        this.opacityVertexArray = new SymbolOpacityArray();
        this.hasVisibleVertices = false;
        this.placedSymbolArray = new PlacedSymbolArray();
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0 &&
            this.indexArray.length === 0 &&
            this.dynamicLayoutVertexArray.length === 0 &&
            this.opacityVertexArray.length === 0;
    }

    upload(context: Context, dynamicIndexBuffer: boolean, upload?: boolean, update?: boolean) {
        if (this.isEmpty()) {
            return;
        }

        if (upload) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, symbolLayoutAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray, dynamicIndexBuffer);
            this.dynamicLayoutVertexBuffer = context.createVertexBuffer(this.dynamicLayoutVertexArray, dynamicLayoutAttributes.members, true);
            this.opacityVertexBuffer = context.createVertexBuffer(this.opacityVertexArray, shaderOpacityAttributes, true);
            // This is a performance hack so that we can write to opacityVertexArray with uint32s
            // even though the shaders read uint8s
            this.opacityVertexBuffer.itemSize = 1;
        }
        if (upload || update) {
            this.programConfigurations.upload(context);
        }
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.dynamicLayoutVertexBuffer.destroy();
        this.opacityVertexBuffer.destroy();
    }
}

register('SymbolBuffers', SymbolBuffers);

class CollisionBuffers {
    layoutVertexArray: StructArray;
    layoutAttributes: Array<StructArrayMember>;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray | LineIndexArray;
    indexBuffer: IndexBuffer;

    segments: SegmentVector;

    collisionVertexArray: CollisionVertexArray;
    collisionVertexBuffer: VertexBuffer;

    constructor(LayoutArray: {
        new (...args: any): StructArray;
    },
    layoutAttributes: Array<StructArrayMember>,
    IndexArray: {
        new (...args: any): TriangleIndexArray | LineIndexArray;
    }) {
        this.layoutVertexArray = new LayoutArray();
        this.layoutAttributes = layoutAttributes;
        this.indexArray = new IndexArray();
        this.segments = new SegmentVector();
        this.collisionVertexArray = new CollisionVertexArray();
    }

    upload(context: Context) {
        this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, this.layoutAttributes);
        this.indexBuffer = context.createIndexBuffer(this.indexArray);
        this.collisionVertexBuffer = context.createVertexBuffer(this.collisionVertexArray, collisionVertexAttributes.members, true);
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();
        this.collisionVertexBuffer.destroy();
    }
}

register('CollisionBuffers', CollisionBuffers);

/**
 * @internal
 * Unlike other buckets, which simply implement #addFeature with type-specific
 * logic for (essentially) triangulating feature geometries, SymbolBucket
 * requires specialized behavior:
 *
 * 1. WorkerTile#parse(), the logical owner of the bucket creation process,
 *    calls SymbolBucket#populate(), which resolves text and icon tokens on
 *    each feature, adds each glyphs and symbols needed to the passed-in
 *    collections options.glyphDependencies and options.iconDependencies, and
 *    stores the feature data for use in subsequent step (this.features).
 *
 * 2. WorkerTile asynchronously requests from the main thread all of the glyphs
 *    and icons needed (by this bucket and any others). When glyphs and icons
 *    have been received, the WorkerTile creates a CollisionIndex and invokes:
 *
 * 3. performSymbolLayout(bucket, stacks, icons) perform texts shaping and
 *    layout on a Symbol Bucket. This step populates:
 *      `this.symbolInstances`: metadata on generated symbols
 *      `this.collisionBoxArray`: collision data for use by foreground
 *      `this.text`: SymbolBuffers for text symbols
 *      `this.icons`: SymbolBuffers for icons
 *      `this.iconCollisionBox`: Debug SymbolBuffers for icon collision boxes
 *      `this.textCollisionBox`: Debug SymbolBuffers for text collision boxes
 *    The results are sent to the foreground for rendering
 *
 * 4. placement.ts is run on the foreground,
 *    and uses the CollisionIndex along with current camera settings to determine
 *    which symbols can actually show on the map. Collided symbols are hidden
 *    using a dynamic "OpacityVertexArray".
 */
export class SymbolBucket implements Bucket {
    static MAX_GLYPHS: number;
    static addDynamicAttributes: typeof addDynamicAttributes;

    collisionBoxArray: CollisionBoxArray;
    zoom: number;
    overscaling: number;
    layers: Array<SymbolStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<SymbolStyleLayer>;
    stateDependentLayerIds: Array<string>;

    index: number;
    sdfIcons: boolean;
    iconsInText: boolean;
    iconsNeedLinear: boolean;
    bucketInstanceId: number;
    justReloaded: boolean;
    hasPattern: boolean;

    textSizeData: SizeData;
    iconSizeData: SizeData;

    glyphOffsetArray: GlyphOffsetArray;
    lineVertexArray: SymbolLineVertexArray;
    features: Array<SymbolFeature>;
    symbolInstances: SymbolInstanceArray;
    textAnchorOffsets: TextAnchorOffsetArray;
    collisionArrays: Array<CollisionArrays>;
    sortKeyRanges: Array<SortKeyRange>;
    pixelRatio: number;
    tilePixelRatio: number;
    compareText: {[_: string]: Array<Point>};
    fadeStartTime: number;
    sortFeaturesByKey: boolean;
    sortFeaturesByY: boolean;
    canOverlap: boolean;
    sortedAngle: number;
    featureSortOrder: Array<number>;

    collisionCircleArray: Array<number>;

    text: SymbolBuffers;
    icon: SymbolBuffers;
    textCollisionBox: CollisionBuffers;
    iconCollisionBox: CollisionBuffers;
    uploaded: boolean;
    sourceLayerIndex: number;
    sourceID: string;
    symbolInstanceIndexes: Array<number>;
    writingModes: WritingMode[];
    allowVerticalPlacement: boolean;
    hasRTLText: boolean;

    constructor(options: BucketParameters<SymbolStyleLayer>) {
        this.collisionBoxArray = options.collisionBoxArray;
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.pixelRatio = options.pixelRatio;
        this.sourceLayerIndex = options.sourceLayerIndex;
        this.hasPattern = false;
        this.hasRTLText = false;
        this.sortKeyRanges = [];

        this.collisionCircleArray = [];

        const layer = this.layers[0];
        const unevaluatedLayoutValues = layer._unevaluatedLayout._values;

        this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
        this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);

        const layout = this.layers[0].layout;
        const sortKey = layout.get('symbol-sort-key');
        const zOrder = layout.get('symbol-z-order');
        this.canOverlap =
            getOverlapMode(layout, 'text-overlap', 'text-allow-overlap') !== 'never' ||
            getOverlapMode(layout, 'icon-overlap', 'icon-allow-overlap') !== 'never' ||
            layout.get('text-ignore-placement') ||
            layout.get('icon-ignore-placement');
        this.sortFeaturesByKey = zOrder !== 'viewport-y' && !sortKey.isConstant();
        const zOrderByViewportY = zOrder === 'viewport-y' || (zOrder === 'auto' && !this.sortFeaturesByKey);
        this.sortFeaturesByY = zOrderByViewportY && this.canOverlap;

        if (layout.get('symbol-placement') === 'point') {
            this.writingModes = layout.get('text-writing-mode').map(wm => WritingMode[wm]);
        }

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);

        this.sourceID = options.sourceID;
    }

    createArrays() {
        this.text = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^text/.test(property)));
        this.icon = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^icon/.test(property)));

        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new SymbolLineVertexArray();
        this.symbolInstances = new SymbolInstanceArray();
        this.textAnchorOffsets = new TextAnchorOffsetArray();
    }

    private calculateGlyphDependencies(
        text: string,
        stack: {[_: number]: boolean},
        textAlongLine: boolean,
        allowVerticalPlacement: boolean,
        doesAllowVerticalWritingMode: boolean) {

        for (let i = 0; i < text.length; i++) {
            stack[text.charCodeAt(i)] = true;
            if ((textAlongLine || allowVerticalPlacement) && doesAllowVerticalWritingMode) {
                const verticalChar = verticalizedCharacterMap[text.charAt(i)];
                if (verticalChar) {
                    stack[verticalChar.charCodeAt(0)] = true;
                }
            }
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        const layer = this.layers[0];
        const layout = layer.layout;

        const textFont = layout.get('text-font');
        const textField = layout.get('text-field');
        const iconImage = layout.get('icon-image');
        const hasText =
            (textField.value.kind !== 'constant' ||
                (textField.value.value instanceof Formatted && !textField.value.value.isEmpty()) ||
                textField.value.value.toString().length > 0) &&
            (textFont.value.kind !== 'constant' || textFont.value.value.length > 0);
        // we should always resolve the icon-image value if the property was defined in the style
        // this allows us to fire the styleimagemissing event if image evaluation returns null
        // the only way to distinguish between null returned from a coalesce statement with no valid images
        // and null returned because icon-image wasn't defined is to check whether or not iconImage.parameters is an empty object
        const hasIcon = iconImage.value.kind !== 'constant' || !!iconImage.value.value || Object.keys(iconImage.parameters).length > 0;
        const symbolSortKey = layout.get('symbol-sort-key');

        this.features = [];

        if (!hasText && !hasIcon) {
            return;
        }

        const icons = options.iconDependencies;
        const stacks = options.glyphDependencies;
        const availableImages = options.availableImages;
        const globalProperties = new EvaluationParameters(this.zoom);

        const splitChars = new Map([
            ['\uE001', new Color(0.941, 0.973, 1, 1)], // AliceBlue
            ['\uE002', new Color(0.98, 0.922, 0.843, 1)], // AntiqueWhite
            ['\uE003', new Color(0, 1, 1, 1)], // Aqua
            ['\uE004', new Color(0.498, 1, 0.831, 1)], // Aquamarine
            ['\uE005', new Color(0.941, 1, 1, 1)], // Azure
            ['\uE006', new Color(0.961, 0.961, 0.863, 1)], // Beige
            ['\uE007', new Color(1, 0.894, 0.769, 1)], // Bisque
            ['\uE008', new Color(0, 0, 0, 1)], // Black
            ['\uE009', new Color(1, 0.922, 0.804, 1)], // BlanchedAlmond
            ['\uE00A', new Color(0, 0, 1, 1)], // Blue
            ['\uE00B', new Color(0.541, 0.169, 0.886, 1)], // BlueViolet
            ['\uE00C', new Color(0.647, 0.165, 0.165)], // Brown
            ['\uE00D', new Color(0.871, 0.722, 0.529, 1)], // BurlyWood
            ['\uE00E', new Color(0.373, 0.62, 0.627, 1)], // CadetBlue
            ['\uE00F', new Color(0.498, 1, 0, 1)], // Chartreuse
            ['\uE010', new Color(0.824, 0.412, 0.118, 1)], // Chocolate
            ['\uE011', new Color(1, 0.498, 0.314, 1)], // Coral
            ['\uE012', new Color(0.392, 0.584, 0.929, 1)], // CornflowerBlue
            ['\uE013', new Color(1, 0.973, 0.863, 1)], // Cornsilk
            ['\uE014', new Color(0.863, 0.078, 0.235, 1)], // Crimson
            ['\uE015', new Color(0, 1, 1, 1)], // Cyan
            ['\uE016', new Color(0, 0, 0.545, 1)], // DarkBlue
            ['\uE017', new Color(0, 0.545, 0.545, 1)], // DarkCyan
            ['\uE018', new Color(0.722, 0.525, 0.043, 1)], // DarkGoldenRod
            ['\uE019', new Color(0.663, 0.663, 0.663, 1)], // DarkGray
            ['\uE01A', new Color(0, 0.392, 0, 1)], // DarkGreen
            ['\uE01B', new Color(0.741, 0.718, 0.42, 1)], // DarkKhaki
            ['\uE01C', new Color(0.545, 0, 0.545, 1)], // DarkMagenta
            ['\uE01D', new Color(0.333, 0.42, 0.184, 1)], // DarkOliveGreen
            ['\uE01E', new Color(1, 0.549, 0, 1)], // DarkOrange
            ['\uE01F', new Color(0.6, 0.196, 0.8, 1)], // DarkOrchid
            ['\uE020', new Color(0.545, 0, 0, 1)], // DarkRed
            ['\uE021', new Color(0.914, 0.588, 0.478, 1)], // DarkSalmon
            ['\uE022', new Color(0.561, 0.737, 0.545, 1)], // DarkSeaGreen
            ['\uE023', new Color(0.282, 0.239, 0.545, 1)], // DarkSlateBlue
            ['\uE024', new Color(0.184, 0.31, 0.31, 1)], // DarkSlateGray
            ['\uE025', new Color(0, 0.808, 0.82, 1)], // DarkTurquoise
            ['\uE026', new Color(0.58, 0, 0.827, 1)], // DarkViolet
            ['\uE027', new Color(1, 0.078, 0.576, 1)], // DeepPink
            ['\uE028', new Color(0, 0.749, 1, 1)], // DeepSkyBlue
            ['\uE029', new Color(0.412, 0.412, 0.412, 1)], // DimGray
            ['\uE02A', new Color(0.118, 0.565, 1, 1)], // DodgerBlue
            ['\uE02B', new Color(0.698, 0.133, 0.133, 1)], // FireBrick
            ['\uE02C', new Color(1, 0.98, 0.941, 1)], // FloralWhite
            ['\uE02D', new Color(0.133, 0.545, 0.133, 1)], // ForestGreen
            ['\uE02E', new Color(1, 0.0, 1, 1)], // Fuchsia
            ['\uE02F', new Color(0.863, 0.863, 0.863, 1)], // Gainsboro
            ['\uE030', new Color(0.973, 0.973, 1, 1)], // GhostWhite
            ['\uE031', new Color(1, 0.843, 0, 1)], // Gold
            ['\uE032', new Color(0.855, 0.647, 0.125, 1)], // GoldenRod
            ['\uE033', new Color(0.502, 0.502, 0.502, 1)], // Gray
            ['\uE034', new Color(0, 0.502, 0)], // Green
            ['\uE035', new Color(0.678, 1, 0.184, 1)], // GreenYellow
            ['\uE036', new Color(0.941, 1, 0.941, 1)], // Honeydew
            ['\uE037', new Color(1, 0.412, 0.706, 1)], // HotPink
            ['\uE038', new Color(0.804, 0.361, 0.361, 1)], // IndianRed
            ['\uE039', new Color(0.294, 0, 0.51, 1)], // Indigo
            ['\uE03A', new Color(1, 1, 0.941, 1)], // Ivory
            ['\uE03B', new Color(0.941, 0.902, 0.549, 1)], // Khaki
            ['\uE03C', new Color(0.902, 0.902, 0.98, 1)], // Lavender
            ['\uE03D', new Color(1, 0.941, 0.961, 1)], // LavenderBlush
            ['\uE03E', new Color(0.486, 0.988, 0, 1)], // LawnGreen
            ['\uE03F', new Color(1, 0.98, 0.804, 1)], // LemonChiffon
            ['\uE040', new Color(0.678, 0.847, 0.902, 1)], // LightBlue
            ['\uE041', new Color(0.941, 0.502, 0.502, 1)], // LightCoral
            ['\uE042', new Color(0.878, 1, 1, 1)], // LightCyan
            ['\uE043', new Color(0.98, 0.98, 0.824, 1)], // LightGoldenRodYellow
            ['\uE044', new Color(0.827, 0.827, 0.827, 1)], // LightGray
            ['\uE045', new Color(0.565, 0.933, 0.565, 1)], // LightGreen
            ['\uE046', new Color(1, 0.714, 0.757, 1)], // LightPink
            ['\uE047', new Color(1, 0.627, 0.478, 1)], // LightSalmon
            ['\uE048', new Color(0.125, 0.698, 0.667, 1)], // LightSeaGreen
            ['\uE049', new Color(0.529, 0.808, 0.98, 1)], // LightSkyBlue
            ['\uE04A', new Color(0.467, 0.533, 0.6, 1)], // LightSlateGray
            ['\uE04B', new Color(0.69, 0.769, 0.871, 1)], // LightSteelBlue
            ['\uE04C', new Color(1, 1, 0.878, 1)], // LightYellow
            ['\uE04D', new Color(0, 1, 0, 1)], // Lime
            ['\uE04E', new Color(0.196, 0.804, 0.196, 1)], // LimeGreen
            ['\uE04F', new Color(0.98, 0.941, 0.902, 1)], // Linen
            ['\uE050', new Color(1, 0.0, 1, 1)], // Magenta
            ['\uE051', new Color(0.502, 0.0, 0.0, 1)], // Maroon
            ['\uE052', new Color(0.4, 0.804, 0.667, 1)], // MediumAquaMarine
            ['\uE053', new Color(0.0, 0.0, 0.804, 1)], // MediumBlue
            ['\uE054', new Color(0.729, 0.333, 0.827, 1)], // MediumOrchid
            ['\uE055', new Color(0.576, 0.439, 0.859, 1)], // MediumPurple
            ['\uE056', new Color(0.235, 0.702, 0.443, 1)], // MediumSeaGreen
            ['\uE057', new Color(0.482, 0.408, 0.933, 1)], // MediumSlateBlue
            ['\uE058', new Color(0.235, 0.702, 0.443, 1)], // MediumSpringGreen
            ['\uE059', new Color(0, 0.98, 0.604, 1)], // MediumTurquoise
            ['\uE05A', new Color(0.78, 0.082, 0.522, 1)], // MediumVioletRed
            ['\uE05B', new Color(0.02, 0.02, 0.439, 1)], // MidnightBlue
            ['\uE05C', new Color(0.098, 0.098, 0.439, 1)], // MintCream
            ['\uE05D', new Color(1, 0.894, 0.882, 1)], // MistyRose
            ['\uE05E', new Color(1, 0.894, 0.71, 1)], // Moccasin
            ['\uE05F', new Color(1, 0.871, 0.678, 1)], // NavajoWhite
            ['\uE060', new Color(0.0, 0.0, 0.502, 1)], // Navy
            ['\uE061', new Color(0.992, 0.961, 0.902, 1)], // OldLace
            ['\uE062', new Color(0.502, 0.502, 0.0, 1)], // Olive
            ['\uE063', new Color(0.42, 0.557, 0.137, 1)], // OliveDrab
            ['\uE064', new Color(1, 0.647, 0, 1)], // Orange
            ['\uE065', new Color(1, 0.271, 0, 1)], // OrangeRed
            ['\uE066', new Color(0.855, 0.439, 0.839, 1)], // Orchid
            ['\uE067', new Color(0.933, 0.91, 0.667, 1)], // PaleGoldenRod
            ['\uE068', new Color(0.596, 0.984, 0.596, 1)], // PaleGreen
            ['\uE069', new Color(0.686, 0.933, 0.933, 1)], // PaleTurquoise
            ['\uE06A', new Color(0.859, 0.439, 0.576, 1)], // PaleVioletRed
            ['\uE06B', new Color(1, 0.937, 0.835, 1)], // PapayaWhip
            ['\uE06C', new Color(1, 0.855, 0.725, 1)], // PeachPuff
            ['\uE06D', new Color(0.804, 0.522, 0.247, 1)], // Peru
            ['\uE06E', new Color(1, 0.753, 0.796, 1)], // Pink
            ['\uE06F', new Color(0.867, 0.627, 0.867, 1)], // Plum
            ['\uE070', new Color(0.69, 0.878, 0.902, 1)], // PowderBlue
            ['\uE071', new Color(0.502, 0.0, 0.502, 1)], // Purple
            ['\uE072', new Color(0.4, 0.2, 0.6, 1)], // RebeccaPurple
            ['\uE073', new Color(1, 0.0, 0.0, 1)], // Red
            ['\uE074', new Color(0.737, 0.561, 0.561, 1)], // RosyBrown
            ['\uE075', new Color(0.255, 0.412, 0.882, 1)], // RoyalBlue
            ['\uE076', new Color(0.545, 0.271, 0.075, 1)], // SaddleBrown
            ['\uE077', new Color(0.98, 0.502, 0.447, 1)], // Salmon
            ['\uE078', new Color(0.957, 0.643, 0.376, 1)], // SandyBrown
            ['\uE079', new Color(0.235, 0.702, 0.443, 1)], // SeaGreen
            ['\uE07A', new Color(1, 0.961, 0.933, 1)], // SeaShell
            ['\uE07B', new Color(0.627, 0.322, 0.176, 1)], // Sienna
            ['\uE07C', new Color(0.753, 0.753, 0.753, 1)], // Silver
            ['\uE07D', new Color(0.529, 0.808, 0.922, 1)], // SkyBlue
            ['\uE07E', new Color(0.416, 0.353, 0.804, 1)], // SlateBlue
            ['\uE07F', new Color(0.439, 0.502, 0.565, 1)], // SlateGray
            ['\uE080', new Color(1, 0.98, 0.98, 1)], // Snow
            ['\uE081', new Color(0, 1, 0.498, 1)], // SpringGreen
            ['\uE082', new Color(0.275, 0.51, 0.706, 1)], // SteelBlue
            ['\uE083', new Color(0.824, 0.706, 0.549, 1)], // Tan
            ['\uE084', new Color(0, 0.502, 0.502, 1)], // Teal
            ['\uE085', new Color(0.847, 0.749, 0.847, 1)], // Thistle
            ['\uE086', new Color(1, 0.388, 0.278, 1)], // Tomato
            ['\uE087', new Color(0.251, 0.878, 0.816, 1)], // Turquoise
            ['\uE088', new Color(0.933, 0.51, 0.933, 1)], // Violet
            ['\uE089', new Color(0.961, 0.871, 0.702, 1)], // Wheat
            ['\uE08A', new Color(1, 1, 1, 1)], // White
            ['\uE08B', new Color(0.961, 0.961, 0.961, 1)], // WhiteSmoke
            ['\uE08C', new Color(1, 1, 0.0, 1)], // Yellow
            ['\uE08D', new Color(0.604, 0.804, 0.196, 1)], // YellowGreen
        ]);
    
        // Optimization 2: Pre-calculate split points to avoid repeated indexOf calls
        function getSplitPoints(text, splitChars) {
            const splitPoints = [];
            for (let i = 0; i < text.length; i++) {
                if (splitChars.has(text[i])) {
                    splitPoints.push(i);
                }
            }
            return splitPoints;
        }

        for (const {feature, id, index, sourceLayerIndex} of features) {

            const needGeometry = layer._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!layer._featureFilter.filter(globalProperties, evaluationFeature, canonical)) {
                continue;
            }

            if (!needGeometry)  evaluationFeature.geometry = loadGeometry(feature);

            let text: Formatted | void;
            if (hasText) {
                // Expression evaluation will automatically coerce to Formatted
                // but plain string token evaluation skips that pathway so do the
                // conversion here.
                const resolvedTokens = layer.getValueAndResolveTokens('text-field', evaluationFeature, canonical, availableImages);
                const formattedText = Formatted.factory(resolvedTokens);
                
                // check for color escape sequences
                if (formattedText) {
                    const updatedSections = [];
                    for (const originalSection of formattedText.sections) {
                        const text = originalSection.text;
                        const splitPoints = getSplitPoints(text, splitChars);
                        if (splitPoints.length > 0) {
                            let lastSplitIndex = 0;  
                            for (let i = 0; i < splitPoints.length; i++) {
                                const splitPoint = splitPoints[i];
                                updatedSections.push({
                                    ...originalSection,
                                    text: text.substring(lastSplitIndex, splitPoint + 1),
                                    textColor: i === 0 ? originalSection.textColor : splitChars.get(text[splitPoints[i - 1]])
                                });   
                                lastSplitIndex = splitPoint + 1;
                            }     
                            // Add the last section
                            if (lastSplitIndex < text.length) {
                                updatedSections.push({
                                    ...originalSection,
                                    text: text.substring(lastSplitIndex),
                                    textColor: splitChars.get(text[splitPoints[splitPoints.length - 1]])
                                });
                            }
                        } else {
                            // No split points found, keep the original section
                            updatedSections.push(originalSection);
                        }
                    }        
                    // Replace all original sections with the updated sections
                    formattedText.sections = updatedSections;
                }
            
                // on this instance: if hasRTLText is already true, all future calls to containsRTLText can be skipped.
                const bucketHasRTLText = this.hasRTLText = (this.hasRTLText || containsRTLText(formattedText));
                if (
                    !bucketHasRTLText || // non-rtl text so can proceed safely
                    rtlWorkerPlugin.getRTLTextPluginStatus() === 'unavailable' || // We don't intend to lazy-load the rtl text plugin, so proceed with incorrect shaping
                    bucketHasRTLText && rtlWorkerPlugin.isParsed() // Use the rtlText plugin to shape text
                ) {
                    text = transformText(formattedText, layer, evaluationFeature);
                }
            }

            let icon: ResolvedImage;
            if (hasIcon) {
                // Expression evaluation will automatically coerce to Image
                // but plain string token evaluation skips that pathway so do the
                // conversion here.
                const resolvedTokens = layer.getValueAndResolveTokens('icon-image', evaluationFeature, canonical, availableImages);
                if (resolvedTokens instanceof ResolvedImage) {
                    icon = resolvedTokens;
                } else {
                    icon = ResolvedImage.fromString(resolvedTokens);
                }
            }

            if (!text && !icon) {
                continue;
            }
            const sortKey = this.sortFeaturesByKey ?
                symbolSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const symbolFeature: SymbolFeature = {
                id,
                text,
                icon,
                index,
                sourceLayerIndex,
                geometry: evaluationFeature.geometry,
                properties: feature.properties,
                type: vectorTileFeatureTypes[feature.type],
                sortKey
            };
            this.features.push(symbolFeature);

            if (icon) {
                icons[icon.name] = true;
            }

            if (text) {
                const fontStack = textFont.evaluate(evaluationFeature, {}, canonical).join(',');
                const textAlongLine = layout.get('text-rotation-alignment') !== 'viewport' && layout.get('symbol-placement') !== 'point';
                this.allowVerticalPlacement = this.writingModes && this.writingModes.indexOf(WritingMode.vertical) >= 0;
                for (const section of text.sections) {
                    if (!section.image) {
                        const doesAllowVerticalWritingMode = allowsVerticalWritingMode(text.toString());
                        const sectionFont = section.fontStack || fontStack;
                        const sectionStack = stacks[sectionFont] = stacks[sectionFont] || {};
                        this.calculateGlyphDependencies(section.text, sectionStack, textAlongLine, this.allowVerticalPlacement, doesAllowVerticalWritingMode);
                    } else {
                        // Add section image to the list of dependencies.
                        icons[section.image.name] = true;
                    }
                }
            }
        }

        if (layout.get('symbol-placement') === 'line') {
            // Merge adjacent lines with the same text to improve labelling.
            // It's better to place labels on one long line than on many short segments.
            //TODO: bug (wrong merging of branching lines)
            //this.features = mergeLines(this.features);
        }

        if (this.sortFeaturesByKey) {
            this.features.sort((a, b) => {
                // a.sortKey is always a number when sortFeaturesByKey is true
                return (a.sortKey as number) - (b.sortKey as number);
            });
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.text.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, imagePositions);
        this.icon.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, imagePositions);
    }

    isEmpty() {
        // When the bucket encounters only rtl-text but the plugin isn't loaded, no symbol instances will be created.
        // In order for the bucket to be serialized, and not discarded as an empty bucket both checks are necessary.
        return this.symbolInstances.length === 0 && !this.hasRTLText;
    }

    uploadPending() {
        return !this.uploaded || this.text.programConfigurations.needsUpload || this.icon.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded && this.hasDebugData()) {
            this.textCollisionBox.upload(context);
            this.iconCollisionBox.upload(context);
        }
        this.text.upload(context, this.sortFeaturesByY, !this.uploaded, this.text.programConfigurations.needsUpload);
        this.icon.upload(context, this.sortFeaturesByY, !this.uploaded, this.icon.programConfigurations.needsUpload);
        this.uploaded = true;
    }

    destroyDebugData() {
        this.textCollisionBox.destroy();
        this.iconCollisionBox.destroy();
    }

    destroy() {
        this.text.destroy();
        this.icon.destroy();

        if (this.hasDebugData()) {
            this.destroyDebugData();
        }
    }

    addToLineVertexArray(anchor: Anchor, line: Array<Point>) {
        const lineStartIndex = this.lineVertexArray.length;
        if (anchor.segment !== undefined) {
            let sumForwardLength = anchor.dist(line[anchor.segment + 1]);
            let sumBackwardLength = anchor.dist(line[anchor.segment]);
            const vertices = {};
            for (let i = anchor.segment + 1; i < line.length; i++) {
                vertices[i] = {x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumForwardLength};
                if (i < line.length - 1) {
                    sumForwardLength += line[i + 1].dist(line[i]);
                }
            }
            for (let i = anchor.segment || 0; i >= 0; i--) {
                vertices[i] = {x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumBackwardLength};
                if (i > 0) {
                    sumBackwardLength += line[i - 1].dist(line[i]);
                }
            }
            for (let i = 0; i < line.length; i++) {
                const vertex = vertices[i];
                this.lineVertexArray.emplaceBack(vertex.x, vertex.y, vertex.tileUnitDistanceFromAnchor);
            }
        }
        return {
            lineStartIndex,
            lineLength: this.lineVertexArray.length - lineStartIndex
        };
    }

    addSymbols(arrays: SymbolBuffers,
        quads: Array<SymbolQuad>,
        sizeVertex: any,
        lineOffset: [number, number],
        alongLine: boolean,
        feature: SymbolFeature,
        writingMode: WritingMode,
        labelAnchor: Anchor,
        lineStartIndex: number,
        lineLength: number,
        associatedIconIndex: number,
        canonical: CanonicalTileID) {
        const indexArray = arrays.indexArray;
        const layoutVertexArray = arrays.layoutVertexArray;

        const segment = arrays.segments.prepareSegment(4 * quads.length, layoutVertexArray, indexArray, this.canOverlap ? feature.sortKey as number : undefined);
        const glyphOffsetArrayStart = this.glyphOffsetArray.length;
        const vertexStartIndex = segment.vertexLength;

        const angle = (this.allowVerticalPlacement && writingMode === WritingMode.vertical) ? Math.PI / 2 : 0;

        const sections = feature.text && feature.text.sections;

        for (let i = 0; i < quads.length; i++) {
            const {tl, tr, bl, br, tex, pixelOffsetTL, pixelOffsetBR, minFontScaleX, minFontScaleY, glyphOffset, isSDF, sectionIndex} = quads[i];
            const index = segment.vertexLength;

            const y = glyphOffset[1];
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);

            addDynamicAttributes(arrays.dynamicLayoutVertexArray, labelAnchor, angle);

            indexArray.emplaceBack(index, index + 2, index + 1);
            indexArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;

            this.glyphOffsetArray.emplaceBack(glyphOffset[0]);

            if (i === quads.length - 1 || sectionIndex !== quads[i + 1].sectionIndex) {
                arrays.programConfigurations.populatePaintArrays(layoutVertexArray.length, feature, feature.index, {}, canonical, sections && sections[sectionIndex]);
            }
        }

        arrays.placedSymbolArray.emplaceBack(
            labelAnchor.x, labelAnchor.y,
            glyphOffsetArrayStart,
            this.glyphOffsetArray.length - glyphOffsetArrayStart,
            vertexStartIndex,
            lineStartIndex,
            lineLength,
            labelAnchor.segment,
            sizeVertex ? sizeVertex[0] : 0,
            sizeVertex ? sizeVertex[1] : 0,
            lineOffset[0], lineOffset[1],
            writingMode,
            // placedOrientation is null initially; will be updated to horizontal(1)/vertical(2) if placed
            0,
            false as unknown as number,
            // The crossTileID is only filled/used on the foreground for dynamic text anchors
            0,
            associatedIconIndex
        );
    }

    _addCollisionDebugVertex(layoutVertexArray: StructArray, collisionVertexArray: StructArray, point: Point, anchorX: number, anchorY: number, extrude: Point) {
        collisionVertexArray.emplaceBack(0, 0);
        return layoutVertexArray.emplaceBack(
            // pos
            point.x,
            point.y,
            // a_anchor_pos
            anchorX,
            anchorY,
            // extrude
            Math.round(extrude.x),
            Math.round(extrude.y));
    }

    addCollisionDebugVertices(x1: number, y1: number, x2: number, y2: number, arrays: CollisionBuffers, boxAnchorPoint: Point, symbolInstance: SymbolInstance) {
        const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
        const index = segment.vertexLength;

        const layoutVertexArray = arrays.layoutVertexArray;
        const collisionVertexArray = arrays.collisionVertexArray;

        const anchorX = symbolInstance.anchorX;
        const anchorY = symbolInstance.anchorY;

        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x1, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x2, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x2, y2));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x1, y2));

        segment.vertexLength += 4;

        const indexArray = arrays.indexArray as LineIndexArray;
        indexArray.emplaceBack(index, index + 1);
        indexArray.emplaceBack(index + 1, index + 2);
        indexArray.emplaceBack(index + 2, index + 3);
        indexArray.emplaceBack(index + 3, index);

        segment.primitiveLength += 4;
    }

    addDebugCollisionBoxes(startIndex: number, endIndex: number, symbolInstance: SymbolInstance, isText: boolean) {
        for (let b = startIndex; b < endIndex; b++) {
            const box: CollisionBox = this.collisionBoxArray.get(b);
            const x1 = box.x1;
            const y1 = box.y1;
            const x2 = box.x2;
            const y2 = box.y2;

            this.addCollisionDebugVertices(x1, y1, x2, y2,
                isText ? this.textCollisionBox : this.iconCollisionBox,
                box.anchorPoint, symbolInstance);
        }
    }

    generateCollisionDebugBuffers() {
        if (this.hasDebugData()) {
            this.destroyDebugData();
        }

        this.textCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);
        this.iconCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);

        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this.addDebugCollisionBoxes(symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance, true);
            this.addDebugCollisionBoxes(symbolInstance.verticalTextBoxStartIndex, symbolInstance.verticalTextBoxEndIndex, symbolInstance, true);
            this.addDebugCollisionBoxes(symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance, false);
            this.addDebugCollisionBoxes(symbolInstance.verticalIconBoxStartIndex, symbolInstance.verticalIconBoxEndIndex, symbolInstance, false);
        }
    }

    // These flat arrays are meant to be quicker to iterate over than the source
    // CollisionBoxArray
    _deserializeCollisionBoxesForSymbol(
        collisionBoxArray: CollisionBoxArray,
        textStartIndex: number,
        textEndIndex: number,
        verticalTextStartIndex: number,
        verticalTextEndIndex: number,
        iconStartIndex: number,
        iconEndIndex: number,
        verticalIconStartIndex: number,
        verticalIconEndIndex: number
    ): CollisionArrays {

        const collisionArrays = {} as CollisionArrays;
        for (let k = textStartIndex; k < textEndIndex; k++) {
            const box: CollisionBox = collisionBoxArray.get(k);
            collisionArrays.textBox = {x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY};
            collisionArrays.textFeatureIndex = box.featureIndex;
            break; // Only one box allowed per instance
        }
        for (let k = verticalTextStartIndex; k < verticalTextEndIndex; k++) {
            const box: CollisionBox = collisionBoxArray.get(k);
            collisionArrays.verticalTextBox = {x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY};
            collisionArrays.verticalTextFeatureIndex = box.featureIndex;
            break; // Only one box allowed per instance
        }
        for (let k = iconStartIndex; k < iconEndIndex; k++) {
            // An icon can only have one box now, so this indexing is a bit vestigial...
            const box: CollisionBox = collisionBoxArray.get(k);
            collisionArrays.iconBox = {x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY};
            collisionArrays.iconFeatureIndex = box.featureIndex;
            break; // Only one box allowed per instance
        }
        for (let k = verticalIconStartIndex; k < verticalIconEndIndex; k++) {
            // An icon can only have one box now, so this indexing is a bit vestigial...
            const box: CollisionBox = collisionBoxArray.get(k);
            collisionArrays.verticalIconBox = {x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY};
            collisionArrays.verticalIconFeatureIndex = box.featureIndex;
            break; // Only one box allowed per instance
        }
        return collisionArrays;
    }

    deserializeCollisionBoxes(collisionBoxArray: CollisionBoxArray) {
        this.collisionArrays = [];
        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this.collisionArrays.push(this._deserializeCollisionBoxesForSymbol(
                collisionBoxArray,
                symbolInstance.textBoxStartIndex,
                symbolInstance.textBoxEndIndex,
                symbolInstance.verticalTextBoxStartIndex,
                symbolInstance.verticalTextBoxEndIndex,
                symbolInstance.iconBoxStartIndex,
                symbolInstance.iconBoxEndIndex,
                symbolInstance.verticalIconBoxStartIndex,
                symbolInstance.verticalIconBoxEndIndex
            ));
        }
    }

    hasTextData() {
        return this.text.segments.get().length > 0;
    }

    hasIconData() {
        return this.icon.segments.get().length > 0;
    }

    hasDebugData() {
        return this.textCollisionBox && this.iconCollisionBox;
    }

    hasTextCollisionBoxData() {
        return this.hasDebugData() && this.textCollisionBox.segments.get().length > 0;
    }

    hasIconCollisionBoxData() {
        return this.hasDebugData() && this.iconCollisionBox.segments.get().length > 0;
    }

    addIndicesForPlacedSymbol(iconOrText: SymbolBuffers, placedSymbolIndex: number) {
        const placedSymbol = iconOrText.placedSymbolArray.get(placedSymbolIndex);

        const endIndex = placedSymbol.vertexStartIndex + placedSymbol.numGlyphs * 4;
        for (let vertexIndex = placedSymbol.vertexStartIndex; vertexIndex < endIndex; vertexIndex += 4) {
            iconOrText.indexArray.emplaceBack(vertexIndex, vertexIndex + 2, vertexIndex + 1);
            iconOrText.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
        }
    }

    getSortedSymbolIndexes(angle: number) {
        if (this.sortedAngle === angle && this.symbolInstanceIndexes !== undefined) {
            return this.symbolInstanceIndexes;
        }
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const rotatedYs = [];
        const featureIndexes = [];
        const result = [];

        for (let i = 0; i < this.symbolInstances.length; ++i) {
            result.push(i);
            const symbolInstance = this.symbolInstances.get(i);
            rotatedYs.push(Math.round(sin * symbolInstance.anchorX + cos * symbolInstance.anchorY) | 0);
            featureIndexes.push(symbolInstance.featureIndex);
        }

        result.sort((aIndex, bIndex) => {
            return (rotatedYs[aIndex] - rotatedYs[bIndex]) ||
                   (featureIndexes[bIndex] - featureIndexes[aIndex]);
        });

        return result;
    }

    addToSortKeyRanges(symbolInstanceIndex: number, sortKey: number) {
        const last = this.sortKeyRanges[this.sortKeyRanges.length - 1];
        if (last && last.sortKey === sortKey) {
            last.symbolInstanceEnd = symbolInstanceIndex + 1;
        } else {
            this.sortKeyRanges.push({
                sortKey,
                symbolInstanceStart: symbolInstanceIndex,
                symbolInstanceEnd: symbolInstanceIndex + 1
            });
        }
    }

    sortFeatures(angle: number) {
        if (!this.sortFeaturesByY) return;
        if (this.sortedAngle === angle) return;

        // The current approach to sorting doesn't sort across segments so don't try.
        // Sorting within segments separately seemed not to be worth the complexity.
        if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1) return;

        // If the symbols are allowed to overlap sort them by their vertical screen position.
        // The index array buffer is rewritten to reference the (unchanged) vertices in the
        // sorted order.

        // To avoid sorting the actual symbolInstance array we sort an array of indexes.
        this.symbolInstanceIndexes = this.getSortedSymbolIndexes(angle);
        this.sortedAngle = angle;

        this.text.indexArray.clear();
        this.icon.indexArray.clear();

        this.featureSortOrder = [];

        for (const i of this.symbolInstanceIndexes) {
            const symbolInstance = this.symbolInstances.get(i);
            this.featureSortOrder.push(symbolInstance.featureIndex);

            [
                symbolInstance.rightJustifiedTextSymbolIndex,
                symbolInstance.centerJustifiedTextSymbolIndex,
                symbolInstance.leftJustifiedTextSymbolIndex
            ].forEach((index, i, array) => {
                // Only add a given index the first time it shows up,
                // to avoid duplicate opacity entries when multiple justifications
                // share the same glyphs.
                if (index >= 0 && array.indexOf(index) === i) {
                    this.addIndicesForPlacedSymbol(this.text, index);
                }
            });

            if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.text, symbolInstance.verticalPlacedTextSymbolIndex);
            }

            if (symbolInstance.placedIconSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.icon, symbolInstance.placedIconSymbolIndex);
            }

            if (symbolInstance.verticalPlacedIconSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.icon, symbolInstance.verticalPlacedIconSymbolIndex);
            }
        }

        if (this.text.indexBuffer) this.text.indexBuffer.updateData(this.text.indexArray);
        if (this.icon.indexBuffer) this.icon.indexBuffer.updateData(this.icon.indexArray);
    }
}

register('SymbolBucket', SymbolBucket, {
    omit: ['layers', 'collisionBoxArray', 'features', 'compareText']
});

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, glyphOffsetArrayStart
// eg the max valid UInt16 is 65,535
// See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
// lineStartIndex and textBoxStartIndex could potentially be concerns
// but we expect there to be many fewer boxes/lines than glyphs
SymbolBucket.MAX_GLYPHS = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

export {addDynamicAttributes};
