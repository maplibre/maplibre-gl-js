import {Texture} from './texture';
import {type Context} from './context';
import {type Framebuffer} from './framebuffer';

export type PoolObject = {
    id: number;
    fbo: Framebuffer;
    texture: Texture;
    stamp: number;
    inUse: boolean;
    /** Identity of the content currently stored in this slot. */
    contentTileKey: string | undefined;
    contentStack: number;
};
/**
 * @internal
 * `RenderPool` is a resource pool for textures and framebuffers
 */
export class RenderPool {
    private _objects: PoolObject[];
    /**
     * An index array of recently used pool objects.
     * Items that are used recently are last in the array
     */
    private _recentlyUsed: number[];
    private _stamp: number;

    constructor(
        private readonly _context: Context,
        private readonly _size: number,
        private readonly _tileSize: number) {
        this._objects = [];
        this._recentlyUsed = [];
        this._stamp = 0;
    }

    public destruct() {
        for (const obj of this._objects) {
            obj.texture.destroy();
            obj.fbo.destroy();
        }
    }

    private _createObject(id: number): PoolObject {
        const fbo = this._context.createFramebuffer(this._tileSize, this._tileSize, true, true);
        const texture = new Texture(this._context, {width: this._tileSize, height: this._tileSize, data: null}, this._context.gl.RGBA);
        texture.bind(this._context.gl.LINEAR, this._context.gl.CLAMP_TO_EDGE);
        if (this._context.extTextureFilterAnisotropic) {
            this._context.gl.texParameterf(this._context.gl.TEXTURE_2D, this._context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this._context.extTextureFilterAnisotropicMax);
        }
        fbo.depthAttachment.set(this._context.createRenderbuffer(this._context.gl.DEPTH_STENCIL, this._tileSize, this._tileSize));
        fbo.colorAttachment.set(texture.texture);
        return {id, fbo, texture, stamp: -1, inUse: false, contentTileKey: undefined, contentStack: -1};
    }

    public getObjectForId(id: number): PoolObject {
        return this._objects[id];
    }

    public useObject(obj: PoolObject) {
        obj.inUse = true;
        this._recentlyUsed = this._recentlyUsed.filter(id => obj.id !== id);
        this._recentlyUsed.push(obj.id);
    }

    public stampObject(obj: PoolObject) {
        obj.stamp = ++this._stamp;
    }

    public getOrCreateFreeObject(): PoolObject {
        // check for free existing object
        for (const id of this._recentlyUsed) {
            if (!this._objects[id].inUse)
                return this._objects[id];
        }
        if (this._objects.length >= this._size)
            throw new Error('No free RenderPool available, call freeAllObjects() required!');
        // create new object
        const obj = this._createObject(this._objects.length);
        this._objects.push(obj);
        return obj;
    }

    /**
     * Returns the slot already holding `(tileKey, stack)` if any, otherwise allocates
     * a fresh slot. The returned slot's `contentTileKey/contentStack` always match the
     * request on return: if it was a cache hit, the caller can use the texture as-is;
     * if it was a fresh allocation, the caller is expected to render new content into
     * the slot. The slot is marked inUse either way.
     *
     * `wasHit` is set true when the returned slot already held the requested content.
     */
    public acquireForContent(tileKey: string, stack: number): {obj: PoolObject; wasHit: boolean} {
        // 1. Existing slot with matching content (cache hit).
        for (const obj of this._objects) {
            if (!obj.inUse && obj.contentTileKey === tileKey && obj.contentStack === stack) {
                obj.inUse = true;
                this._recentlyUsed = this._recentlyUsed.filter(id => obj.id !== id);
                this._recentlyUsed.push(obj.id);
                return {obj, wasHit: true};
            }
        }
        // 2. Allocate a fresh / never-occupied slot if available.
        if (this._objects.length < this._size) {
            const obj = this._createObject(this._objects.length);
            obj.contentTileKey = tileKey;
            obj.contentStack = stack;
            obj.inUse = true;
            this._objects.push(obj);
            this._recentlyUsed.push(obj.id);
            return {obj, wasHit: false};
        }
        // 3. Evict LRU free slot, reassign.
        for (const id of this._recentlyUsed) {
            const candidate = this._objects[id];
            if (!candidate.inUse) {
                candidate.contentTileKey = tileKey;
                candidate.contentStack = stack;
                candidate.inUse = true;
                this._recentlyUsed = this._recentlyUsed.filter(x => x !== id);
                this._recentlyUsed.push(id);
                return {obj: candidate, wasHit: false};
            }
        }
        throw new Error('No free RenderPool available, call freeAllObjects() required!');
    }

    /** Mark a slot as no longer holding valid content (e.g. on fingerprint invalidation). */
    public clearContent(obj: PoolObject) {
        obj.contentTileKey = undefined;
        obj.contentStack = -1;
    }

    public freeObject(obj: PoolObject) {
        obj.inUse = false;
    }

    public freeAllObjects() {
        for (const obj of this._objects)
            this.freeObject(obj);
    }

    public isFull(): boolean {
        if (this._objects.length < this._size) {
            return false;
        }
        return this._objects.some(o => !o.inUse) === false;
    }
}
