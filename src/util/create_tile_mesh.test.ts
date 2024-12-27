import {describe, expect, test, vi} from 'vitest';
import {createTileMesh, createTileMeshWithBuffers, type CreateTileMeshOptions} from './create_tile_mesh';

describe('create_tile_mesh', () => {
    test('createTileMeshWithBuffers should create buffer in the right size', () => {
        const createVertexBufferSpy = vi.fn();
        const createIndexBufferSpy = vi.fn();
        const contextMock: any = {
            createVertexBuffer: createVertexBufferSpy,
            createIndexBuffer: createIndexBufferSpy
        };
        const options: CreateTileMeshOptions = {};
        createTileMeshWithBuffers(contextMock, options);

        expect(createVertexBufferSpy.mock.calls[0][0].length).toBe(4);
        expect(createIndexBufferSpy.mock.calls[0][0].length).toBe(2);
    });

    test('createTileMesh 32bit', () => {
        const mesh = createTileMesh({}, '32bit');
        expect(mesh.indices.byteLength).toBe(6 * 2 * 2); // 32bit
        expect(mesh.vertices.byteLength).toBe(8 * 2); // 16bit
    });

    test('createTileMesh 16bit', () => {
        const mesh = createTileMesh({}, '16bit');
        expect(mesh.indices.byteLength).toBe(6 * 2); // 16bit
        expect(mesh.vertices.byteLength).toBe(8 * 2); // 16bit
    });
});