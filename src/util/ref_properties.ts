import type {FillLayerSpecification} from '@maplibre/maplibre-gl-style-spec';

// keyof LayerSpecification is the intersection of all variants' keys — that
// excludes `source`/`source-layer`/`filter` because BackgroundLayerSpecification
// doesn't have them. FillLayerSpecification is a representative variant that
// has the full set we care about for ref resolution.
export const refProperties: Array<keyof FillLayerSpecification> = ['type', 'source', 'source-layer', 'minzoom', 'maxzoom', 'filter', 'layout'];