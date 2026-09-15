# Single DEM peak

Opaque 64 × 64 Terrarium tile at 10/512/512. Every sample is 0 m except (31, 31), which is 3,000 m. No border pixels are included. For each integer height h, write R = floor((h + 32768) / 256), G = (h + 32768) % 256, B = 0, A = 255 with pngjs PNG.sync.write.

The peak is centred at tile-local (31.5/64, 31.5/64). The render fixture uses this same source for terrain and hillshade.

The camera targets that cell centre at zoom 12.5, pitch 60°, bearing 30°, with ground clamping disabled and centre elevation fixed at 1,500 m after loading. This keeps the camera identical when the terrain sampler changes. Map-anchored hillshade illumination is 315°.
