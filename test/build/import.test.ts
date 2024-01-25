import {LngLat} from '../../dist/maplibre-gl';

describe('Importing a class', () => {
    it('should allow import and contruct', () => {
        const ll = new LngLat(1, 2);
        expect(ll.lng).toBe(1);
        expect(ll.lat).toBe(2);
    });
});
