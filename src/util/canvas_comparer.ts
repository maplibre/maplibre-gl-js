export default class CanvasComparer {
    private canvas1: OffscreenCanvas;
    private canvas2: OffscreenCanvas;
    private ctx1: any;
    private ctx2: any;

    constructor() {
        this.canvas1 = new OffscreenCanvas(100, 100);
        this.canvas2 = new OffscreenCanvas(100, 100);
        this.ctx1 = this.canvas1.getContext('2d', { willReadFrequently: true });
        this.ctx2 = this.canvas2.getContext('2d', { willReadFrequently: true });

        this.ctx1.font = '24px Arial';
        this.ctx2.font = '24px Arial';
    }

    private compareCanvases(string1: string, string2: string): boolean {
        this.ctx1.clearRect(0, 0, this.canvas1.width, this.canvas1.height);
        this.ctx2.clearRect(0, 0, this.canvas2.width, this.canvas2.height);

        this.ctx1.fillText(`${string1}${string2}`, 10, 40);

        const parts = [string1, string2];
        let offset = 0;
        for (const part of parts) {
            this.ctx2.fillText(part, 10 + offset, 40);
            offset += this.ctx2.measureText(part).width;
        }

        const imageData1 = this.ctx1.getImageData(0, 0, this.canvas1.width, this.canvas1.height);
        const imageData2 = this.ctx2.getImageData(0, 0, this.canvas2.width, this.canvas2.height);

        if (imageData1.data.length !== imageData2.data.length) {
            return false;
        } else {
            for (let i = 0; i < imageData1.data.length; i++) {
                if (imageData1.data[i] !== imageData2.data[i]) {
                    return false;
                }
            }
            return true;
        }
    }

    public mergeStrings(parts: string[]): string[] {
        let i = 0;
        while (i < parts.length - 1) {
            if (!this.compareCanvases(parts[i], parts[i + 1])) {
                parts.splice(i, 2, parts[i] + parts[i + 1]);
                i = 0;
                continue;
            }
            i++;
        }
        return parts;
    }
}
