// Test ESM import
import maplibregl from './dist/maplibre-gl-dev.mjs';

console.log('Testing ESM module import...');
console.log('maplibregl version:', maplibregl.getVersion ? maplibregl.getVersion() : 'N/A');
console.log('maplibregl exports:', Object.keys(maplibregl).slice(0, 10));

// Test if worker URL can be set
if (typeof maplibregl.setWorkerUrl === 'function') {
    console.log('✓ setWorkerUrl function exists');
} else {
    console.log('✗ setWorkerUrl function missing');
}

// Test if Map class exists
if (maplibregl.Map) {
    console.log('✓ Map class exists');
} else {
    console.log('✗ Map class missing');
}

console.log('\nESM module test completed successfully!');
