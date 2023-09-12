import type {StyleSpecification} from '@globalfishingwatch/maplibre-gl-style-spec';

export default function fetchStyle(value: string | StyleSpecification): Promise<StyleSpecification> {
    return typeof value === 'string' ?
        fetch(value).then(response => response.json()) :
        Promise.resolve(value);
}
