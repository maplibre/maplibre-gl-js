import {ErrorEvent, Evented} from '../util/evented.ts';
import {MapStyleImageMissingEvent} from '../ui/events.ts';
import {RGBAImage} from '../util/image.ts';
import {renderStyleImage} from '../style/style_image.ts';
import {warnOnce} from '../util/util.ts';

import type {StyleImage} from '../style/style_image.ts';
import type {GetImagesResponse} from '../util/actor_messages.ts';

export type MissingImageRequestHandler = (id: string) => void | Promise<void>;

type ImageManagerEventType = {
    error: ErrorEvent;
    styleimagemissing: MapStyleImageMissingEvent;
};

/**
 * Owns every image of the style - the ones the sprites bring in as well as the ones added at
 * runtime - and tracks requests for them from the tile workers, sending responses when the
 * requests are fulfilled.
*/
export class ImageManager extends Evented<ImageManagerEventType> {
    images: Record<string, StyleImage>;
    /**
     * Incremented on every {@link ImageManager.updateImage} call. {@link ImageAtlas} instances
     * compare it against the value they last patched against, so that a tile whose atlas is up to
     * date can skip its patching work entirely.
     */
    updateVersion: number;
    loaded: boolean;
    /**
     * This is used to track requests for images that are not yet available. When the image is loaded,
     * the requestors will be notified.
     */
    requestors: Array<{
        ids: string[];
        promiseResolve: (value: GetImagesResponse | PromiseLike<GetImagesResponse>) => void;
    }>;
    missingImageResolver: MissingImageRequestHandler | null;
    /**
     * The images whose `render` callback already ran in the current frame. A given image usually
     * sits in the atlas of several tiles, so it would otherwise be asked to re-render once per
     * tile that holds it.
     */
    private _renderCallbacksDispatchedThisFrame: Record<string, boolean>;
    /**
     * The ids of the images each sprite has brought in, keyed by sprite id, so that they can be
     * removed again when that sprite is reloaded or removed.
     */
    private _spriteImagesIds: Record<string, string[]>;
    /** Cached result of {@link ImageManager.listImages}, invalidated whenever an image is added or removed */
    private _imagesIds: string[] | null;

    constructor() {
        super();
        this.images = {};
        this.updateVersion = 0;
        this.loaded = false;
        this.requestors = [];
        this.missingImageResolver = null;
        this._spriteImagesIds = {};
        this._imagesIds = null;
        this._renderCallbacksDispatchedThisFrame = {};
    }

    destroy(): void {
        for (const id of Object.keys(this.images)) {
            this.removeImage(id);
        }
        this._spriteImagesIds = {};
    }
    isLoaded(): boolean {
        return this.loaded;
    }

    setLoaded(loaded: boolean): void {
        if (this.loaded === loaded) {
            return;
        }

        this.loaded = loaded;

        if (loaded) {
            for (const {ids, promiseResolve} of this.requestors) {
                promiseResolve(this._getImagesForIds(ids));
            }
            this.requestors = [];
        }
    }

    getImage(id: string): StyleImage {
        const image = this.images[id];
        // Extract sprite image data on demand
        if (image && !image.data && image.spriteData) {
            const spriteData = image.spriteData;
            image.data = new RGBAImage({
                width: spriteData.width,
                height: spriteData.height
            }, spriteData.context.getImageData(
                spriteData.x,
                spriteData.y,
                spriteData.width,
                spriteData.height).data);
            image.spriteData = null;
        }

        return image;
    }

    addImage(id: string, image: StyleImage): void {
        if (this.images[id]) throw new Error(`Image id ${id} already exist, use updateImage instead`);
        if (this._validate(id, image)) {
            this.images[id] = image;
            this._imagesIds = null;
            if (image.isWebGLImage) this.updateImage(id, image, false);
        }
    }

    _validate(id: string, image: StyleImage): boolean {
        let valid = true;
        const data = image.data || image.spriteData;
        if (!this._validateStretch(image.stretchX, data?.width)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchX" value`)));
            valid = false;
        }
        if (!this._validateStretch(image.stretchY, data?.height)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchY" value`)));
            valid = false;
        }
        if (!this._validateContent(image.content, image)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "content" value`)));
            valid = false;
        }
        return valid;
    }

    _validateStretch(stretch: Array<[number, number]>, size: number): boolean {
        if (!stretch) return true;
        let last = 0;
        for (const part of stretch) {
            if (part[0] < last || part[1] < part[0] || size < part[1]) return false;
            last = part[1];
        }
        return true;
    }

    _validateContent(content: [number, number, number, number], image: StyleImage): boolean {
        if (!content) return true;
        if (content.length !== 4) return false;
        const spriteData = image.spriteData;
        const width = (spriteData?.width) || image.data.width;
        const height = (spriteData?.height) || image.data.height;
        if (content[0] < 0 || width < content[0]) return false;
        if (content[1] < 0 || height < content[1]) return false;
        if (content[2] < 0 || width < content[2]) return false;
        if (content[3] < 0 || height < content[3]) return false;
        if (content[2] < content[0]) return false;
        return content[3] >= content[1];
    }

    /**
     * Replaces an image that is already known under this id, bumping its version so that the
     * atlases holding it notice.
     *
     * The old record is read directly rather than through {@link ImageManager.getImage}, which
     * would force a synchronous decode of the sprite data of the very image being replaced. Its
     * size therefore comes from whichever of the two the pixels are still in, since an image that
     * came from a sprite and was never rendered has not been decoded yet, and its version is
     * defaulted, since images start out without one.
     *
     * @param validate - whether to reject an image of a different size than the one it replaces
     */
    updateImage(id: string, image: StyleImage, validate: boolean = true): void {
        const oldImage = this.images[id];
        if (validate) {
            const oldData = oldImage.data || oldImage.spriteData;
            if (oldData.width !== image.data.width || oldData.height !== image.data.height) {
                throw new Error(`size mismatch between old image (${oldData.width}x${oldData.height}) and new image (${image.data.width}x${image.data.height}).`);
            }
        }
        image.version = (oldImage.version ?? 0) + 1;
        this.images[id] = image;
        this.updateVersion++;
    }

    removeImage(id: string): void {
        const image = this.images[id];
        if (!image) return;
        delete this.images[id];
        this._imagesIds = null;

        if (image.userImage?.onRemove) {
            image.userImage.onRemove();
        }
    }

    /**
     * @returns the ids of every image currently held, sprite images and runtime ones alike. The
     * returned array is shared between callers and must not be modified.
     */
    listImages(): string[] {
        this._imagesIds ??= Object.keys(this.images);
        return this._imagesIds;
    }

    /**
     * Images of the `default` sprite keep their plain id, the ones of any other sprite are
     * namespaced by their sprite's id.
     */
    private _getSpriteImageId(spriteId: string, imageId: string): string {
        return spriteId === 'default' ? imageId : `${spriteId}:${imageId}`;
    }

    /**
     * Takes over the images of a single sprite: adds the new ones, updates the ones that are
     * already known, and removes the ones that a previous load of this same sprite had brought in
     * but that are not part of it anymore.
     *
     * @param spriteId - the id of the sprite the images belong to
     * @param images - the sprite's images, keyed by their id within the sprite
     * @returns the ids of the images that this sprite now provides, and the ids of the ones that
     * were removed because they are no longer part of it
     */
    setSpriteImages(spriteId: string, images: Record<string, StyleImage>): {loaded: string[]; removed: string[]} {
        const previousIds = this._spriteImagesIds[spriteId] ?? [];
        const loaded: string[] = [];

        for (const id in images) {
            const imageId = this._getSpriteImageId(spriteId, id);
            loaded.push(imageId);

            if (imageId in this.images) {
                this.updateImage(imageId, images[id], false);
            } else {
                this.addImage(imageId, images[id]);
            }
        }

        const loadedIds = new Set(loaded);
        const removed = previousIds.filter(imageId => !loadedIds.has(imageId));
        for (const imageId of removed) {
            this.removeImage(imageId);
        }

        this._spriteImagesIds[spriteId] = loaded;
        return {loaded, removed};
    }

    /**
     * Removes all the images a single sprite has brought in.
     * @returns the ids of the removed images
     */
    removeSpriteImages(spriteId: string): string[] {
        const removed = this._spriteImagesIds[spriteId] ?? [];
        for (const imageId of removed) {
            this.removeImage(imageId);
        }

        delete this._spriteImagesIds[spriteId];
        return removed;
    }

    /**
     * Removes the images of every sprite, leaving the images added at runtime alone.
     * @returns the ids of the removed images
     */
    removeAllSpriteImages(): string[] {
        const removed = Object.values(this._spriteImagesIds).flat();
        for (const imageId of removed) {
            this.removeImage(imageId);
        }

        this._spriteImagesIds = {};
        return removed;
    }

    setMissingImageResolver(resolver: MissingImageRequestHandler | null): void {
        this.missingImageResolver = resolver;
    }

    getImages(ids: string[]): Promise<GetImagesResponse> {
        return new Promise<GetImagesResponse>((resolve, _reject) => {
            // If the sprite has been loaded, or if all the icon dependencies are already present
            // (i.e. if they've been added via runtime styling), then notify the requestor immediately.
            // Otherwise, delay notification until the sprite is loaded. At that point, if any of the
            // dependencies are still unavailable, we'll just assume they are permanently missing.
            let hasAllDependencies = true;
            if (!this.isLoaded()) {
                for (const id of ids) {
                    if (!this.images[id]) {
                        hasAllDependencies = false;
                    }
                }
            }
            if (this.isLoaded() || hasAllDependencies) {
                resolve(this._getImagesForIds(ids));
            } else {
                this.requestors.push({ids, promiseResolve: resolve});
            }
        });
    }

    async _getImagesForIds(ids: string[]): Promise<GetImagesResponse> {
        const unresolvedIds = new Set(ids.filter((id) => !this.getImage(id)));
        const resolver = this.missingImageResolver;

        if (resolver) {
            await Promise.allSettled(Array.from(unresolvedIds, (id) => resolver(id)));
        }

        const response: GetImagesResponse = {};

        for (const id of ids) {
            const image = this.getImage(id);

            if (image) {
                unresolvedIds.delete(id);
                // Clone the image so that our own copy of its ArrayBuffer doesn't get transferred.
                response[id] = {
                    data: image.data.clone(),
                    pixelRatio: image.pixelRatio,
                    sdf: image.sdf,
                    version: image.version,
                    stretchX: image.stretchX,
                    stretchY: image.stretchY,
                    content: image.content,
                    textFitWidth: image.textFitWidth,
                    textFitHeight: image.textFitHeight,
                    hasRenderCallback: Boolean(image.userImage?.render),
                    isWebGLImage: image.isWebGLImage
                };
            }
        }

        for (const id of unresolvedIds) {
            this.fire(new MapStyleImageMissingEvent({id}));
            warnOnce(`Image "${id}" could not be loaded. Please make sure you have added the image before it is needed with map.addImage(), resolved it with map.setMissingStyleImageResolver(), or included it in a "sprite" property in your style.`);
        }

        return response;
    }

    beginFrame(): void {
        this._renderCallbacksDispatchedThisFrame = {};
    }

    /**
     * Re-renders the images among `ids` that were added with a `render` callback (see
     * `StyleImageInterface`), at most once per frame each.
     */
    dispatchRenderCallbacks(ids: string[]): void {
        for (const id of ids) {
            if (this._renderCallbacksDispatchedThisFrame[id]) continue;
            this._renderCallbacksDispatchedThisFrame[id] = true;

            const image = this.getImage(id);
            if (!image) warnOnce(`Image with ID: "${id}" was not found`);

            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, image);
            }
        }
    }

    cloneImages(): Record<string, StyleImage> {
        const clonedImages: Record<string, StyleImage> = {};
        for (const id in this.images) {
            const image = this.images[id];
            clonedImages[id] = {
                ...image,
                data: image.data ? image.data.clone() : null
            };
        }
        return clonedImages;
    }
}
