import type {Device} from '@luma.gl/core';
import type {Model} from '@luma.gl/engine';

/**
 * Cache for WebGPU pipeline/Model objects.
 * Key: hash(shaderName + defines + renderState + vertexLayout)
 * Value: luma.gl Model
 *
 * This avoids recreating render pipelines every frame, which is
 * expensive in WebGPU since pipeline state is immutable.
 */
export class PipelineCache {
    _cache: Map<string, Model>;

    constructor() {
        this._cache = new Map();
    }

    get(key: string): Model | undefined {
        return this._cache.get(key);
    }

    set(key: string, model: Model): void {
        this._cache.set(key, model);
    }

    has(key: string): boolean {
        return this._cache.has(key);
    }

    invalidate(): void {
        // Models are owned by luma.gl and will be GC'd
        this._cache.clear();
    }

    destroy(): void {
        this._cache.clear();
    }
}
