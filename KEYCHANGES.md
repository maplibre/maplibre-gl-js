### text placed on line not effected by zoom
/src/symbol/symbol_layout.ts
    addFeature()
TODO: scale with glyph size (latitude dependend)

### constant size for globe and zoom

/src/geo/projection/globe_camera_helpers.ts
    handleMapControlsPan():
        zoom does not change with pitch of globe
    handleEaseTo():
        zoom does not change with pitch of globe

/src/geo/projection/globe_utils.ts
    getGlobeRadiusPixels
        TODO: Need to be revised!!!
        not sure if this works as intended and might have introducted some jumpyness, especially wenn
        transitioning between globe and mercator

        
        
        width of line stays constant when globe is pitched