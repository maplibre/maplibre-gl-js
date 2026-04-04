/**
 * Renderer interface — both WebGL2 and WebGPU renderers implement this.
 *
 * The renderer handles all GPU-specific operations:
 * - Device/context creation
 * - Buffer and texture management
 * - Shader compilation and pipeline creation
 * - Render pass management
 * - Draw call submission
 * - Stencil clipping
 *
 * Everything above this (style evaluation, tile management, symbol placement,
 * projection math) is shared and API-agnostic.
 */

import type {IReadonlyTransform} from '../geo/transform_interface';
import type {Style} from '../style/style';

export type BackendType = 'webgl2' | 'webgpu';

export interface RendererOptions {
    showTileBoundaries?: boolean;
    showOverdrawInspector?: boolean;
    showPadding?: boolean;
    wireframe?: boolean;
    fadeDuration?: number;
    anisotropicFilterPitch?: number;
    moving?: boolean;
}

/**
 * Abstract renderer interface.
 * WebGL2Renderer and WebGPURenderer each implement this.
 */
export interface IRenderer {
    /** The backend type */
    readonly type: BackendType;

    /** Canvas width in device pixels */
    width: number;
    /** Canvas height in device pixels */
    height: number;
    /** Device pixel ratio */
    pixelRatio: number;

    /** Resize the renderer */
    resize(width: number, height: number, pixelRatio: number): void;

    /** Render a frame */
    render(style: Style, options: RendererOptions): void;

    /** Clean up GPU resources */
    destroy(): void;

    /** Check if the renderer's context is lost */
    isContextLost(): boolean;
}
