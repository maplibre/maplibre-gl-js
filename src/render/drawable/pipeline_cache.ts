
/**
 * Cache for WebGPU pipeline/any objects.
 * Key: hash(shaderName + defines + renderState + vertexLayout)
 * Value: luma.gl any
 *
 * This avoids recreating render pipelines every frame, which is
 * expensive in WebGPU since pipeline state is immutable.
 */
export class PipelineCache {
    _cache: Map<string, any>;

    constructor() {
        this._cache = new Map();
    }

    get(key: string): any | undefined {
        return this._cache.get(key);
    }

    set(key: string, model: any): void {
        this._cache.set(key, model);
    }

    has(key: string): boolean {
        return this._cache.has(key);
    }

    invalidate(): void {
        // anys are owned by luma.gl and will be GC'd
        this._cache.clear();
    }

    destroy(): void {
        this._cache.clear();
    }
}
