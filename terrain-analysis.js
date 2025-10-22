/* terrain-analysis.js */
(function() {
  const DEBUG = true;
  const EXTENT = 8192;
  const TILE_SIZE = 256;
  const DEM_MAX_ZOOM = 16; // native DEM max zoom
  
  // Global state variables
  let currentMode = ""; // "normal", "avalanche", "slope", "aspect", "snow", or "shadow"
  const meshCache = new Map();
  let snowAltitude = 3000;
  let snowMaxSlope = 55; // in degrees
  
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
  function getTileMesh(gl, tile) {
    const key = `mesh_${tile.tileID.key}`;
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
  
  // Define the custom terrain layer.
  const terrainNormalLayer = {
    id: 'terrain-normal',
    type: 'custom',
    renderingMode: '3d',
    shaderMap: new Map(),
    frameCount: 0,
    
    onAdd(mapInstance, gl) { 
      this.map = mapInstance; 
      this.gl = gl;
      this.frameCount = 0;
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
        'u_latrange',
        'u_lightDir',
        'u_shadowsEnabled'
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
  
    renderTiles(gl, shader, renderableTiles) {
      const bindTexture = (texture, unit, uniformName) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(shader.locations[uniformName], unit);
      };
  
      // Keep track of successfully rendered tiles for debugging
      let renderedCount = 0;
      let skippedCount = 0;
      
      for (const tile of renderableTiles) {
        // Get the source tile to ensure we have the right tile for this position
        const sourceTile = this.map.terrain.sourceCache.getSourceTile(tile.tileID, true);
        
        // Skip if no source tile or if it's a different tile (overscaled)
        if (!sourceTile || sourceTile.tileID.key !== tile.tileID.key) {
          if (DEBUG) console.log(`Skipping tile ${tile.tileID.key}: source tile mismatch or overscaled`);
          skippedCount++;
          continue;
        }
        
        // Get terrain data for the exact tile
        const terrainData = this.map.terrain.getTerrainData(tile.tileID);
        
        // Skip if no terrain data or texture
        if (!terrainData || !terrainData.texture) {
          if (DEBUG) console.log(`Skipping tile ${tile.tileID.key}: no terrain data or texture`);
          skippedCount++;
          continue;
        }
        
        // Skip fallback tiles as they might not align properly
        if (terrainData.fallback) {
          if (DEBUG) console.log(`Skipping tile ${tile.tileID.key}: fallback tile`);
          skippedCount++;
          continue;
        }
        
        const mesh = getTileMesh(gl, tile);
        if (!mesh) continue;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.enableVertexAttribArray(shader.attributes.a_pos);
        gl.vertexAttribPointer(shader.attributes.a_pos, 2, gl.SHORT, false, 4, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
        
        // Only bind texture if it exists
        if (terrainData.texture) {
          bindTexture(terrainData.texture, 0, 'u_image');
        }
        
        const projectionData = this.map.transform.getProjectionData({
          overscaledTileID: tile.tileID,
          applyGlobeMatrix: true
        });
        
        gl.uniform4f(shader.locations.u_projection_tile_mercator_coords,
          ...projectionData.tileMercatorCoords);
        gl.uniform4f(shader.locations.u_projection_clipping_plane, ...projectionData.clippingPlane);
        gl.uniform1f(shader.locations.u_projection_transition, projectionData.projectionTransition);
        gl.uniformMatrix4fv(shader.locations.u_projection_matrix, false, projectionData.mainMatrix);
        gl.uniformMatrix4fv(shader.locations.u_projection_fallback_matrix, false, projectionData.fallbackMatrix);
        gl.uniform2f(shader.locations.u_dimension, TILE_SIZE, TILE_SIZE);
        gl.uniform1i(shader.locations.u_original_vertex_count, mesh.originalVertexCount);
        gl.uniform1f(shader.locations.u_terrain_exaggeration, 1.0);
        const rgbaFactors = {
            r: 65536.0 * 0.1,
            g: 256.0 * 0.1,
            b: 0.1,
            base: 10000.0
        };
        gl.uniform4f(
            shader.locations.u_terrain_unpack,
            rgbaFactors.r,
            rgbaFactors.g,
            rgbaFactors.b,
            rgbaFactors.base
        );
        gl.uniform2f(shader.locations.u_latrange, 47.0, 45.0);
        gl.uniform1f(shader.locations.u_zoom, tile.tileID.canonical.z);
        
        if (currentMode === "snow" && shader.locations.u_snow_altitude) {
          gl.uniform1f(shader.locations.u_snow_altitude, snowAltitude);
          gl.uniform1f(shader.locations.u_snow_maxSlope, snowMaxSlope);
        }
        if (currentMode === "shadow" && shader.locations.u_shadowHorizontalScale) {
          const tileZoom = tile.tileID.canonical.z;
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
  
    render(gl, matrix) {
      // Increment frame counter
      this.frameCount++;
      
      // Skip the first few frames to ensure everything is initialized
      if (this.frameCount < 3) {
        this.map.triggerRepaint();
        return;
      }
      
      // Wait for tiles to stabilize after rapid movement
      if (this.map.terrain.sourceCache.anyTilesAfterTime(Date.now() - 100)) {
        this.map.triggerRepaint();
        return;
      }
      
      const shader = this.getShader(gl, matrix.shaderData);
      if (!shader) return;
      gl.useProgram(shader.program);
      
      const sourceCache = this.map.terrain.sourceCache;
      const renderableTiles = sourceCache.getRenderableTiles();
      
      // Don't render if we have no tiles
      if (renderableTiles.length === 0) {
        if (DEBUG) console.log("No renderable tiles available");
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
        this.renderTiles(gl, shader, renderableTiles);
        
        gl.colorMask(true, true, true, true);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        );
        this.renderTiles(gl, shader, renderableTiles);
      } else {
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if (currentMode === "shadow") {
          gl.disable(gl.BLEND);
        } else {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
        this.renderTiles(gl, shader, renderableTiles);
      }
      
      gl.disable(gl.BLEND);
    }
  };
  
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
  
  map.on('load', () => {
    console.log("Map loaded");
    map.setTerrain({ source: 'terrain', exaggeration: 1.0 });
    if (map.terrain && map.terrain.sourceCache) {
      map.terrain.sourceCache.deltaZoom = 0;
    }
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
  
  window.addEventListener('unload', () => { meshCache.clear(); });
})();