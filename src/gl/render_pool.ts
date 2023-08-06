import {Texture} from '../render/texture';
import {Context} from './context';
import {Framebuffer} from './framebuffer';

export type PoolObject = {
    id: number;
    fbo: Framebuffer;
    texture: Texture;
    stamp: number;
    inUse: boolean;
};
/**
 * @internal
 * `RenderPool` is a resource pool for textures and framebuffers
 */
export class RenderPool {
    private _objects: Array<PoolObject>;
    /**
     * An index array of recently used pool objects.
     * Items that are used recently are last in the array
     */
    private _recentlyUsed: Array<number>;
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
        fbo.depthAttachment.set(this._context.createRenderbuffer(this._context.gl.DEPTH_STENCIL, this._tileSize, this._tileSize));
        fbo.colorAttachment.set(texture.texture);
        return {id, fbo, texture, stamp: -1, inUse: false};
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
