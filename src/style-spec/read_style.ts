import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';
import type {StyleSpecification} from './types.g';

export default function readStyle(style: StyleSpecification | string | Buffer): StyleSpecification {
    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            return jsonlint.parse(style.toString());
        } catch (e) {
            throw new ParsingError(e);
        }
    }

    return style;
}
