import path from 'path';
import fs from 'fs';
import {type SourceSpecification, type StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

export function localizeURLs(style: StyleSpecification, port: number, baseTestsDir: string) {
    localizeStyleURLs(style, port);
    if (!(style.metadata as any)?.test?.operations) {
        return;
    }
    for (const op of (style.metadata as any).test.operations) {
        if (op[0] === 'addSource') {
            localizeSourceURLs(op[2], port);
        } else if (op[0] === 'setStyle') {
            if (typeof op[1] === 'object') {
                localizeStyleURLs(op[1], port);
                return;
            }

            try {
                const relativePath = op[1].replace(/^local:\/\//, '');
                const styleJSON = fs.readFileSync(path.join(baseTestsDir, 'assets', relativePath), 'utf8');
                const styleJSONObject = JSON.parse(styleJSON);
                localizeStyleURLs(styleJSONObject, port);
                op[1] = styleJSONObject;
                op[2] = {diff: false};
            } catch (error) {
                console.log(`* Error while parsing ${op[1]}: ${error}`);
                return;
            }
        }
    }
}

function localizeURL(url: string, port: number) {
    return url.replace(/^local:\/\//, `http://localhost:${port}/`);
}

function localizeMapboxSpriteURL(url: string, port: number) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/`);
}

function localizeMapboxFontsURL(url: string, port: number) {
    return url.replace(/^mapbox:\/\/fonts/, `http://localhost:${port}/glyphs`);
}

function localizeMapboxTilesURL(url: string, port: number) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/tiles/`);
}

function localizeMapboxTilesetURL(url: string, port: number) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/tilesets/`);
}

function localizeSourceURLs(source: SourceSpecification, port: number) {
    if ('tiles' in source && Array.isArray(source.tiles)) {
        for (const tile in source.tiles) {
            source.tiles[tile] = localizeMapboxTilesURL(source.tiles[tile], port);
            source.tiles[tile] = localizeURL(source.tiles[tile], port);
        }
    }

    if ('urls' in source) {
        source.urls = source.urls.map((url) => localizeMapboxTilesetURL(url, port));
        source.urls = source.urls.map((url) => localizeURL(url, port));
    }

    if ('url' in source) {
        source.url = localizeMapboxTilesetURL(source.url, port);
        source.url = localizeURL(source.url, port);
    }

    if ('data' in source && typeof source.data == 'string') {
        source.data = localizeURL(source.data, port);
    }
}

function localizeStyleURLs(style: StyleSpecification, port: number) {
    for (const source in style.sources) {
        localizeSourceURLs(style.sources[source], port);
    }

    if (style.sprite) {
        if (typeof style.sprite === 'string') {
            style.sprite = localizeMapboxSpriteURL(style.sprite, port);
            style.sprite = localizeURL(style.sprite, port);
        } else if (Array.isArray(style.sprite)) {
            for (const sprite of style.sprite) {
                sprite.url = localizeMapboxSpriteURL(sprite.url, port);
                sprite.url = localizeURL(sprite.url, port);
            }
        }
    }

    if (style.glyphs) {
        style.glyphs = localizeMapboxFontsURL(style.glyphs, port);
        style.glyphs = localizeURL(style.glyphs, port);
    }
}
