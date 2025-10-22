/* terrain-analysis.js */
(function() {
  const DEBUG = true;
  const EXTENT = 8192;
  const TILE_SIZE = 256;
  const DEM_MAX_ZOOM = 16; // native DEM max zoom
  const DEM_CACHE_MAX_AGE_MS = 2 * 60 * 1000; // drop DEM data after inactivity
  const TEXTURE_UNUSED_FRAME_LIMIT = 240; // frames before GPU textures are released
  
  // Global state variables
  let currentMode = ""; // "normal", "avalanche", "slope", "aspect", "snow", or "shadow"
  const meshCache = new Map();
  const terrainDEMCache = new Map(); // key -> {dem, tileID, updated, lastUsed}
  let snowAltitude = 3000;
  let snowMaxSlope = 55; // in degrees
  let mapInstance = null;
  
  // Update UI button states and slider visibility based on current mode
  function updateButtons() {
    document.getElementById('normalBtn').classList.toggle('active', currentMode === "normal");
    document.getElementById('avalancheBtn').classList.toggle('active', currentMode === "avalanche");
    document.getElementById('slopeBtn').classList.toggle('active', currentMode === "slope");
    document.getElementById('aspectBtn').classList.toggle('active', currentMode === "aspect");
    document.getElementById('snowBtn').classList.toggle('active', currentMode === "snow");
    document.getElementById('shadowBtn').classList.toggle('active', currentMode === "shadow");
    document.getElementById('snowSliderContainer').style.display = (currentMode === "snow") ? "block" : "none";
    document.getElementById('shadowControls').style.display = (currentMode === "shadow") ? "flex" : "none";
  }
  
  // Slider event listeners
  document.getElementById('snowAltitudeSlider').addEventListener('input', (e) => {
    snowAltitude = parseFloat(e.target.value);
    document.getElementById('snowAltitudeValue').textContent = e.target.value;
    if (currentMode === "snow") map.triggerRepaint();
  });
  document.getElementById('snowSlopeSlider').addEventListener('input', (e) => {
    snowMaxSlope = parseFloat(e.target.value);
    document.getElementById('snowSlopeValue').textContent = e.target.value;
    if (currentMode === "snow") map.triggerRepaint();
  });
  document.getElementById('shadowStepSlider').addEventListener('input', (e) => {
    document.getElementById('shadowStepValue').textContent = e.target.value;
    if (currentMode === "shadow") map.triggerRepaint();
  });
  document.getElementById('shadowScaleSlider').addEventListener('input', (e) => {
    document.getElementById('shadowScaleValue').textContent = e.target.value;
    if (currentMode === "shadow") map.triggerRepaint();
  });
  document.getElementById('shadowLengthSlider').addEventListener('input', (e) => {
    document.getElementById('shadowLengthValue').textContent = e.target.value;
    if (currentMode === "shadow") map.triggerRepaint();
  });
  
  // Minimal getTileMesh: create or return cached mesh for a tile
  function getTileMesh(gl, tileID) {
    const key = `mesh_${tileID.key}`;
    if (meshCache.has(key)) return meshCache.get(key);
    const meshBuffers = maplibregl.createTileMesh({ granularity: 128, generateBorders: false, extent: EXTENT }, '16bit');
    const vertices = new Int16Array(meshBuffers.vertices);
    const indices = new Int16Array(meshBuffers.indices);
    const vertexCount = vertices.length / 2;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    const mesh = { vbo, ibo, indexCount: indices.length, originalVertexCount: vertexCount };
    meshCache.set(key, mesh);
    return mesh;
  }

  function makeTileCacheKey(tileID) {
    const canonical = tileID.canonical;
    return `${tileID.overscaledZ}:${tileID.wrap}:${canonical.z}:${canonical.x}:${canonical.y}`;
  }

  function getNeighborKey(tileID, dx, dy) {
    const canonical = tileID.canonical;
    const dim = Math.pow(2, canonical.z);
    let nx = canonical.x + dx;
    let ny = canonical.y + dy;
    let wrap = tileID.wrap;

    if (ny < 0 || ny >= dim) return null;

    if (nx < 0) {
      nx += dim;
      wrap -= 1;
    } else if (nx >= dim) {
      nx -= dim;
      wrap += 1;
    }

    return `${tileID.overscaledZ}:${wrap}:${canonical.z}:${nx}:${ny}`;
  }
  
  // Define the custom terrain layer.
  const terrainNormalLayer = {
    id: 'terrain-normal',
    type: 'custom',
    renderingMode: '3d',
    shaderMap: new Map(),
    frameCount: 0,
    textureCache: new Map(),
    
    onAdd(mapInstance, gl) {
      this.map = mapInstance;
      this.gl = gl;
      this.frameCount = 0;
      this.textureCache = new Map();

      for (const key of terrainDEMCache.keys()) {
        this.refreshTextureForKey(key);
      }
    },

    onRemove() {
      if (this.gl) {
        for (const entry of this.textureCache.values()) {
          this.gl.deleteTexture(entry.texture);
        }
      }
      this.textureCache.clear();
      this.gl = null;
      this.map = null;
    },
  
    getShader(gl, shaderDescription) {
      const variantName = shaderDescription.variantName + "_" + currentMode;
      if (this.shaderMap.has(variantName)) return this.shaderMap.get(variantName);
      
      // Build the shader sources using our TerrainShaders helper.
      const vertexSource = TerrainShaders.getVertexShader(shaderDescription, EXTENT);
      const fragmentSource = TerrainShaders.getFragmentShader(currentMode);
      
      const program = gl.createProgram();
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
        return null;
      }
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error:", gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
      }
      const uniforms = [
        'u_matrix',
        'u_projection_matrix',
        'u_projection_clipping_plane',
        'u_projection_transition',
        'u_projection_tile_mercator_coords',
        'u_projection_fallback_matrix',
        'u_image',
        'u_image_left',
        'u_image_right',
        'u_image_top',
        'u_image_bottom',
        'u_image_topLeft',
        'u_image_topRight',
        'u_image_bottomLeft',
        'u_image_bottomRight',
        'u_dimension',
        'u_original_vertex_count',
        'u_terrain_unpack',
        'u_terrain_exaggeration',
        'u_zoom',
        'u_latrange'
      ];
      if (currentMode === "snow") {
        uniforms.push('u_snow_altitude', 'u_snow_maxSlope');
      }
      if (currentMode === "shadow") {
        uniforms.push('u_shadowStepSize','u_shadowHorizontalScale','u_shadowLengthFactor');
      }
      const locations = {};
      uniforms.forEach(u => { locations[u] = gl.getUniformLocation(program, u); });
      const attributes = { a_pos: gl.getAttribLocation(program, 'a_pos') };
      const result = { program, locations, attributes };
      this.shaderMap.set(variantName, result);
      return result;
    },
  
    createTextureFromDEM(demEntry) {
      if (!this.gl || !demEntry) return null;
      const gl = this.gl;
      const texture = gl.createTexture();
      if (!texture) return null;
      const pixels = demEntry.dem.getPixels();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixels.width, pixels.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return {
        texture,
        dim: demEntry.dem.dim,
        unpack: demEntry.dem.getUnpackVector(),
        tileID: demEntry.tileID,
        width: pixels.width,
        height: pixels.height,
        lastUsedFrame: this.frameCount
      };
    },

    refreshTextureForKey(key) {
      if (!this.gl || !key) return;
      const demEntry = terrainDEMCache.get(key);
      if (!demEntry) return;

      let textureEntry = this.textureCache.get(key);
      const gl = this.gl;
      const pixels = demEntry.dem.getPixels();

      if (!textureEntry) {
        textureEntry = this.createTextureFromDEM(demEntry);
        if (textureEntry) {
          this.textureCache.set(key, textureEntry);
        }
      } else {
        gl.bindTexture(gl.TEXTURE_2D, textureEntry.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixels.width, pixels.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels.data);
        textureEntry.dim = demEntry.dem.dim;
        textureEntry.unpack = demEntry.dem.getUnpackVector();
        textureEntry.tileID = demEntry.tileID;
        textureEntry.width = pixels.width;
        textureEntry.height = pixels.height;
      }
    },

    ensureTextureForKey(key) {
      if (!key) return null;
      let textureEntry = this.textureCache.get(key);
      if (!textureEntry) {
        this.refreshTextureForKey(key);
        textureEntry = this.textureCache.get(key);
      }
      if (textureEntry) {
        textureEntry.lastUsedFrame = this.frameCount;
        const demEntry = terrainDEMCache.get(key);
        if (demEntry) demEntry.lastUsed = Date.now();
      }
      return textureEntry;
    },

    dropTextureForKey(key) {
      if (!key) return;
      const entry = this.textureCache.get(key);
      if (entry && this.gl) {
        this.gl.deleteTexture(entry.texture);
      }
      this.textureCache.delete(key);
    },

    pruneCaches() {
      if (!this.gl) return;
      const cutoff = this.frameCount - TEXTURE_UNUSED_FRAME_LIMIT;
      for (const [key, entry] of this.textureCache.entries()) {
        if (entry.lastUsedFrame < cutoff) {
          this.gl.deleteTexture(entry.texture);
          this.textureCache.delete(key);
        }
      }

      const now = Date.now();
      for (const [key, entry] of terrainDEMCache.entries()) {
        const lastUsed = entry.lastUsed || entry.updated;
        if (now - lastUsed > DEM_CACHE_MAX_AGE_MS) {
          terrainDEMCache.delete(key);
          this.dropTextureForKey(key);
        }
      }
    },

    renderTiles(gl, shader, tileIDs, options) {
      const bindTexture = (textureEntry, unit, uniformName) => {
        const location = shader.locations[uniformName];
        if (!textureEntry || location == null) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, textureEntry.texture);
        gl.uniform1i(location, unit);
      };

      let renderedCount = 0;
      let skippedCount = 0;

      for (const tileID of tileIDs) {
        const key = makeTileCacheKey(tileID);
        const centerTexture = this.ensureTextureForKey(key);
        if (!centerTexture) {
          if (DEBUG) console.log(`Skipping tile ${key}: no DEM texture available`);
          skippedCount++;
          continue;
        }

        const mesh = getTileMesh(gl, tileID);
        if (!mesh) continue;

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.enableVertexAttribArray(shader.attributes.a_pos);
        gl.vertexAttribPointer(shader.attributes.a_pos, 2, gl.SHORT, false, 4, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const neighborTextures = {
          u_image_left: this.ensureTextureForKey(getNeighborKey(tileID, -1, 0)) || centerTexture,
          u_image_right: this.ensureTextureForKey(getNeighborKey(tileID, 1, 0)) || centerTexture,
          u_image_top: this.ensureTextureForKey(getNeighborKey(tileID, 0, -1)) || centerTexture,
          u_image_bottom: this.ensureTextureForKey(getNeighborKey(tileID, 0, 1)) || centerTexture,
          u_image_topLeft: this.ensureTextureForKey(getNeighborKey(tileID, -1, -1)) || centerTexture,
          u_image_topRight: this.ensureTextureForKey(getNeighborKey(tileID, 1, -1)) || centerTexture,
          u_image_bottomLeft: this.ensureTextureForKey(getNeighborKey(tileID, -1, 1)) || centerTexture,
          u_image_bottomRight: this.ensureTextureForKey(getNeighborKey(tileID, 1, 1)) || centerTexture
        };

        bindTexture(centerTexture, 0, 'u_image');
        bindTexture(neighborTextures.u_image_left, 1, 'u_image_left');
        bindTexture(neighborTextures.u_image_right, 2, 'u_image_right');
        bindTexture(neighborTextures.u_image_top, 3, 'u_image_top');
        bindTexture(neighborTextures.u_image_bottom, 4, 'u_image_bottom');
        bindTexture(neighborTextures.u_image_topLeft, 5, 'u_image_topLeft');
        bindTexture(neighborTextures.u_image_topRight, 6, 'u_image_topRight');
        bindTexture(neighborTextures.u_image_bottomLeft, 7, 'u_image_bottomLeft');
        bindTexture(neighborTextures.u_image_bottomRight, 8, 'u_image_bottomRight');

        const projectionData = this.map.transform.getProjectionData({
          overscaledTileID: tileID,
          applyGlobeMatrix: true
        });

        if (shader.locations.u_projection_tile_mercator_coords) {
          gl.uniform4f(shader.locations.u_projection_tile_mercator_coords, ...projectionData.tileMercatorCoords);
        }
        if (shader.locations.u_projection_clipping_plane) {
          gl.uniform4f(shader.locations.u_projection_clipping_plane, ...projectionData.clippingPlane);
        }
        if (shader.locations.u_projection_transition) {
          gl.uniform1f(shader.locations.u_projection_transition, projectionData.projectionTransition);
        }
        if (shader.locations.u_projection_matrix) {
          gl.uniformMatrix4fv(shader.locations.u_projection_matrix, false, projectionData.mainMatrix);
        }
        if (shader.locations.u_projection_fallback_matrix) {
          gl.uniformMatrix4fv(shader.locations.u_projection_fallback_matrix, false, projectionData.fallbackMatrix);
        }
        if (shader.locations.u_dimension) {
          gl.uniform2f(shader.locations.u_dimension, centerTexture.dim, centerTexture.dim);
        }
        if (shader.locations.u_original_vertex_count) {
          gl.uniform1i(shader.locations.u_original_vertex_count, mesh.originalVertexCount);
        }
        if (shader.locations.u_terrain_exaggeration) {
          gl.uniform1f(shader.locations.u_terrain_exaggeration, 1.0);
        }
        if (shader.locations.u_terrain_unpack) {
          const unpack = centerTexture.unpack;
          gl.uniform4f(shader.locations.u_terrain_unpack, unpack[0], unpack[1], unpack[2], unpack[3]);
        }
        if (shader.locations.u_latrange) {
          gl.uniform2f(shader.locations.u_latrange, 47.0, 45.0);
        }
        if (shader.locations.u_zoom) {
          gl.uniform1f(shader.locations.u_zoom, tileID.canonical.z);
        }

        if (shader.locations.u_matrix) {
          gl.uniformMatrix4fv(shader.locations.u_matrix, false, options.modelViewProjectionMatrix);
        }

        if (currentMode === "snow" && shader.locations.u_snow_altitude) {
          gl.uniform1f(shader.locations.u_snow_altitude, snowAltitude);
          gl.uniform1f(shader.locations.u_snow_maxSlope, snowMaxSlope);
        }
        if (currentMode === "shadow" && shader.locations.u_shadowHorizontalScale) {
          const tileZoom = tileID.canonical.z;
          const maxZoom = 16.0;
          const adaptiveStep = parseFloat(document.getElementById('shadowStepSlider').value) * Math.pow(2, (maxZoom - tileZoom));
          gl.uniform1f(shader.locations.u_shadowStepSize, adaptiveStep);
          gl.uniform1f(shader.locations.u_shadowHorizontalScale, parseFloat(document.getElementById('shadowScaleSlider').value));
          gl.uniform1f(shader.locations.u_shadowLengthFactor, parseFloat(document.getElementById('shadowLengthSlider').value));
        }

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        renderedCount++;
      }

      if (DEBUG && (renderedCount > 0 || skippedCount > 0)) {
        console.log(`Rendered ${renderedCount} tiles, skipped ${skippedCount} tiles`);
      }
    },

    render(gl, options) {
      this.frameCount++;

      const shader = this.getShader(gl, options.shaderData);
      if (!shader) return;
      gl.useProgram(shader.program);

      const tileIDs = this.map.coveringTiles({ tileSize: TILE_SIZE, maxzoom: DEM_MAX_ZOOM });
      if (tileIDs.length === 0) {
        if (DEBUG) console.log("No covering tiles available");
        this.map.triggerRepaint();
        return;
      }

      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.enable(gl.DEPTH_TEST);

      if (currentMode === "snow" || currentMode === "slope") {
        gl.depthFunc(gl.LESS);
        gl.colorMask(false, false, false, false);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.renderTiles(gl, shader, tileIDs, options);

        gl.colorMask(true, true, true, true);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        );
        this.renderTiles(gl, shader, tileIDs, options);
      } else {
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if (currentMode === "shadow") {
          gl.disable(gl.BLEND);
        } else {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
        this.renderTiles(gl, shader, tileIDs, options);
      }

      gl.disable(gl.BLEND);
      this.pruneCaches();
    }
  };

  function handleTerrainSourceData(event) {
    if (!event || event.sourceId !== 'terrain' || !event.tile) return;
    const tile = event.tile;
    const key = makeTileCacheKey(tile.tileID);

    if (tile.state === 'loaded' && tile.dem) {
      terrainDEMCache.set(key, {
        dem: tile.dem,
        tileID: tile.tileID,
        updated: Date.now(),
        lastUsed: Date.now()
      });
      terrainNormalLayer.refreshTextureForKey(key);
      if (mapInstance && mapInstance.getLayer && mapInstance.getLayer('terrain-normal')) {
        mapInstance.triggerRepaint();
      }
    } else if (tile.state === 'unloaded') {
      terrainDEMCache.delete(key);
      terrainNormalLayer.dropTextureForKey(key);
    }
  }

  // Map setup and initialization.
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        swisstopo: {
          type: 'raster',
          tileSize: 256,
          tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg'],
          attribution: '© Swisstopo',
          maxzoom: 19
        },
        terrain: {
          type: 'raster-dem',
          tiles: ['https://tiles.wifidb.net/data/swissalti3d_terrainrgb_0-16/{z}/{x}/{y}.webp'],
          tileSize: 256,
          maxzoom: 16,
          encoding: 'mapbox'
        }
      },
      layers: [
        { id: 'swisstopo', type: 'raster', source: 'swisstopo', paint: {'raster-opacity': 1.0} }
      ],
      terrain: { source: 'terrain', exaggeration: 1.0 },
      background: { paint: { "background-color": "#ffffff" } }
    },
    zoom: 14,
    center: [7.73044, 46.09915],
    pitch: 45,
    hash: true,
    maxPitch: 65,
    maxZoom: 16,
    minZoom: 2,
    fadeDuration: 500
  });
  mapInstance = map;

  map.on('sourcedata', handleTerrainSourceData);

  map.on('load', () => {
    console.log("Map loaded");
    map.setTerrain({ source: 'terrain', exaggeration: 1.0 });
    console.log("Terrain layer initialized");
  });
  
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }));
  map.addControl(new maplibregl.GlobeControl());
  map.addControl(new maplibregl.TerrainControl());
  
  // Button click event listeners to toggle rendering modes.
  document.getElementById('normalBtn').addEventListener('click', () => { 
    currentMode = currentMode === "normal" ? "" : "normal";
    if (currentMode === "normal") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  document.getElementById('avalancheBtn').addEventListener('click', () => { 
    currentMode = currentMode === "avalanche" ? "" : "avalanche";
    if (currentMode === "avalanche") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  document.getElementById('slopeBtn').addEventListener('click', () => { 
    currentMode = currentMode === "slope" ? "" : "slope";
    if (currentMode === "slope") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  document.getElementById('aspectBtn').addEventListener('click', () => { 
    currentMode = currentMode === "aspect" ? "" : "aspect";
    if (currentMode === "aspect") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  document.getElementById('snowBtn').addEventListener('click', () => { 
    currentMode = currentMode === "snow" ? "" : "snow";
    if (currentMode === "snow") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  document.getElementById('shadowBtn').addEventListener('click', () => { 
    currentMode = currentMode === "shadow" ? "" : "shadow";
    if (currentMode === "shadow") {
      if (!map.getLayer("terrain-normal")) {
        terrainNormalLayer.frameCount = 0; // Reset frame counter
        map.addLayer(terrainNormalLayer);
      }
    } else {
      if (map.getLayer("terrain-normal")) map.removeLayer("terrain-normal");
    }
    terrainNormalLayer.shaderMap.clear();
    updateButtons();
    map.triggerRepaint();
  });
  
  window.addEventListener('unload', () => {
    meshCache.clear();
    terrainDEMCache.clear();
  });
})();
