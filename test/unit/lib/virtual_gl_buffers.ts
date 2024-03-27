export class VirtualVertexBuffer {
    public data: Array<number> = [];

    public get length(): number {
        return this.data.length / 2;
    }

    public emplaceBack(x, y) {
        this.data.push(x, y);
    }

    public addVertices(numVertices: number) {
        for (let i = 0; i < numVertices; i++) {
            this.emplaceBack(0, 0);
        }
    }
}

export class VirtualIndexBufferTriangles {
    public data: Array<number> = [];

    public get length(): number {
        return this.data.length / 3;
    }

    public emplaceBack(i0, i1, i2) {
        this.data.push(i0, i1, i2);
    }
}

export class VirtualIndexBufferLines {
    public data: Array<number> = [];

    public get length(): number {
        return this.data.length / 2;
    }

    public emplaceBack(i0, i1) {
        this.data.push(i0, i1);
    }
}
