// test/unit/util/color.test.ts

import { packColor } from '../data/program_configuration';
import { packUint8ToFloat } from '../shaders/encode_attribute'; // Ensure this function is imported or defined if needed

describe('packColor', () => {
    it('should handle null colors', () => {
        const defaultPackedColor = packColor(null);
        const expectedPackedColor = [
            packUint8ToFloat(0, 0),
            packUint8ToFloat(0, 255)
        ];

        expect(defaultPackedColor).toEqual(expectedPackedColor);
    });
});
