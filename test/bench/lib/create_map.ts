import {Map} from '../../../src/ui/map';

const createMap = (options: any): Promise<Map> => {
    return new Promise((resolve, reject) => {
        if (options) {
            options.stubRender = options.stubRender == null ? true : options.stubRender;
            options.showMap = options.showMap == null ? false : options.showMap;
        }

        const container = document.createElement('div');
        container.style.width = `${options.width || 512}px`;
        container.style.height = `${options.height || 512}px`;
        container.style.margin = '0 auto';
        container.style.display = 'block';

        if (!options.showMap) {
            container.style.visibility = 'hidden';
        }
        document.body.appendChild(container);

        const map = new Map(Object.assign({
            container,
            style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
        }, options));

        map
            .on(options.idle ? 'idle' : 'load', () => {
                if (options.stubRender) {
                    // If there's a pending rerender, cancel it.
                    if (map._frameRequest) {
                        map._frameRequest.abort();
                        map._frameRequest = null;
                    }
                }
                resolve(map);
            })
            .on('error', (e) => reject(e.error))
            .on('remove', () => container.remove());
    });
};

export default createMap;
