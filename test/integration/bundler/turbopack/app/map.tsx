'use client';

import {useEffect, useRef} from 'react';
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export default function MapView() {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const map = new Map({
            container: container.current!,
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 1
        });
        return () => map.remove();
    }, []);

    return <div ref={container} style={{height: '100vh'}} />;
}
