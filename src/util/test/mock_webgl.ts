import gl from 'gl';

export function setupMockWebGLContext(webglContext: any) {

    const mockVaoExtension = {
        bindVertexArrayOES: jest.fn(),
        deleteVertexArrayOES: jest.fn(),
        createVertexArrayOES: jest.fn(),
    };

    const mockColorBufferExtension = {
        RGB16F_EXT: jest.fn(),
    };

    const mockTextureHalfFloatExtension = {
        HALF_FLOAT_OES: jest.fn(),
    };

    // Setup getExtension to return the correct mock extension
    webglContext.getExtension = jest.fn((extensionName) => {
        switch (extensionName) {
            case 'OES_vertex_array_object':
                return mockVaoExtension;
            case 'EXT_color_buffer_half_float':
                return mockColorBufferExtension;
            case 'OES_texture_half_float':
                return mockTextureHalfFloatExtension;
            default:
                return null;
        }
    });

    // Update drawingBufferWidth and drawingBufferHeigth when viewport changes
    webglContext.viewport = jest.fn((x, y, width, height) => {
        webglContext.drawingBufferWidth = width;
        webglContext.drawingBufferHeight = height;
    });

    // Define the properties on the WebGL context
    Object.defineProperty(webglContext, 'bindVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.bindVertexArrayOES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'RGB16F', {
        get() {
            const extension = this.getExtension('EXT_color_buffer_half_float');
            return extension ? extension.RGB16F_EXT : undefined;
        },
    });

    Object.defineProperty(webglContext, 'HALF_FLOAT', {
        get() {
            const extension = this.getExtension('OES_texture_half_float');
            return extension ? extension.HALF_FLOAT_OES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'deleteVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.deleteVertexArrayOES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'createVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.createVertexArrayOES : undefined;
        },
    });

}

// Add webgl context with the supplied GL
export function setWebGlContext() {
    const originalGetContext = global.HTMLCanvasElement.prototype.getContext;

    function imitateWebGlGetContext(type, attributes) {
        if (type === 'webgl2') {
            return null;
        }
        if (type === 'webgl') {
            if (!this._webGLContext) {
                this._webGLContext = gl(this.width, this.height, attributes);
                if (!this._webGLContext) {
                    throw new Error('Failed to create a WebGL context');
                }
            }

            setupMockWebGLContext(this._webGLContext);

            return this._webGLContext;
        }
        // Fallback to existing HTMLCanvasElement getContext behaviour
        return originalGetContext.call(this, type, attributes);
    }
    global.HTMLCanvasElement.prototype.getContext = imitateWebGlGetContext;
}
