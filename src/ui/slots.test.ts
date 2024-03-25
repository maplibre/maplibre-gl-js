
describe('Slots', () => {
    test('Empty slot does not affect rendering of free layers', () => {
    });
    test('fillSlotWithLayers adds 2 layers before a layer that comes after a slot', () => {
    });
    test('fillSlotWithLayers appends 2 layers when there is no more layers after a slot', () => {
    });
    test('Layers are inserted into Style._layers in the same order as provided to fillSlotWithLayers', () => {
    });
    test('fillSlotWithLayers empties the slot if empty array is passed to fillSlot', () => {
    });
    test('fillSlotWithLayers empties the slot before inserting new layers', () => {
    });
    test('fillSlotWithLayers does not throw when called with wrong slotId', () => {
    });
    test('fillSlotWithLayers keeps layers in slot untouched when called with invalid layers argument', () => {
    });
    test('fillSlotWithLayers adds layers when Style._layers was empty', () => {
    });
    test('fillSlotWithLayers adds layers in correct position when the next layer was an empty slot and there were no layers after that', () => {
    });
    test('fillSlotWithLayers adds layers in correct position when the next layer was a filled slot', () => {
    });
    test('map.addLayer adds a layer before a slot when called with beforeId === slotId', () => {
    });
    test('map.addLayer adds a layer to a slot when called with beforeId === idOfSlottedLayer', () => {
        // It's against my design
        // but it will be cruel to fail a user in this situation
    });
    test('After setStyle with {diff: false} slots are emptied and can be filled again', () => {
    });
    test('After setStyle with {diff: true} slots are emptied and can be filled again', () => {
        // This can be an inconvenience to a user but I think it'll be difficult to do it otherwise
        // Also, with slots there will less reason to call setStyle
        // - because in many cases fillSlotWithLayers will be a good alternative
    });
    test('fillSlotWithLayers does not insert layers when called called with an id of free layer', () => {
    });
    test('New slot cannot be added via map.addLayer', () => {
    });
    test('Calling map.removeLayer with slotted layer id removes this layer from a slot', () => {
    });
    test('calling map.removeLayer with slot id does not remove a slot', () => {
        // Because it makes no sense to remove slots
    });
    test('QUESTIONNABLE: map.getStyle returns only regular layers, both free and slotted ones, but without slots themselves', () => {
        // This is how it will work by default (it returns layers from Style._layers, and it doesn't contain slots).
        // Returning slots and slotted layers together is problematic in current implementation
    });
    test('map.getLayersOrder returns only regular layers, both free and slotted ones, but without slots themselves', () => {
    });
    test('map.getLayer(slotId) returns [what?]', () => {
        // Perhaps it will be nice to tell what layers are now in this slot
    });
    test('map.moveLayer(slotId) does not move slot', () => {
        // Makes little sense and hard to implement
    });
    test('map.moveLayer(slottedLayerId) removes layer from its slot, if new position is outside the slot', () => {
    });
    test('map.moveLayer(layerId) adds a previously unslotted layer to a slot, if new position is within this slot', () => {
    });
    test('map.setLayerZoomRange(slotId) does [what?]', () => {
        // It can set a zoom range on every slotted layer
    });
});
