import * as maplibregl from './index';

// put all exports from package to window.maplibregl object
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
(window as any).maplibregl = maplibregl;