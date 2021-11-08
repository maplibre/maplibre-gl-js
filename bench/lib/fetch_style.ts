import type {StyleSpecification} from '../../src/style-spec/types';

export default function fetchStyle(value: string | StyleSpecification): Promise<StyleSpecification> {
    return typeof value === 'string' ?
        fetch(value).then(response => response.json()) :
        Promise.resolve(value);
}
