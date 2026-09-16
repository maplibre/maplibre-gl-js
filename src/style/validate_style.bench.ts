import {bench} from 'vitest';
import {validateStyle} from './validate_style.ts';
import brightV9 from '../../test/integration/assets/styles/bright-v9.json' with {type: 'json'};

import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

const style = brightV9 as unknown as StyleSpecification;

bench('validateStyle', () => {
    validateStyle(style);
});
