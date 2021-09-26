import type {StyleSpecification} from '../../src/style-spec/types';
import {RequestManager} from '../../src/util/request_manager';

const requestManager = new RequestManager();

export default function fetchStyle(value: string | StyleSpecification): Promise<StyleSpecification> {
    return typeof value === 'string' ?
        fetch(value) as any :
        Promise.resolve(value);
}
