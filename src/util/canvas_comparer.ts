export default class CanvasComparer {
    private static canvas1: OffscreenCanvas = new OffscreenCanvas(50, 15);
    private static canvas2: OffscreenCanvas = new OffscreenCanvas(50, 15);
    private static ctx1: any = CanvasComparer.canvas1.getContext('2d', { willReadFrequently: true });
    private static ctx2: any = CanvasComparer.canvas2.getContext('2d', { willReadFrequently: true });

    constructor() {
        // this.canvas1 = new OffscreenCanvas(50, 15);
        // this.canvas2 = new OffscreenCanvas(50, 15);
        // this.ctx1 = this.canvas1.getContext('2d', { willReadFrequently: true });
        // this.ctx2 = this.canvas2.getContext('2d', { willReadFrequently: true });

        CanvasComparer.ctx1.font = '6px Arial';
        CanvasComparer.ctx2.font = '6px Arial';
    }

    private compareCanvases(string1: string, string2: string): boolean {
        CanvasComparer.ctx1.clearRect(0, 0, CanvasComparer.canvas1.width, CanvasComparer.canvas1.height);
        CanvasComparer.ctx2.clearRect(0, 0, CanvasComparer.canvas2.width, CanvasComparer.canvas2.height);

        CanvasComparer.ctx1.fillText(`${string1}${string2}`, 0, 10);
        const offset1 = CanvasComparer.ctx1.measureText(`${string1}${string2}`).width;

        const parts = [string1, string2];
        let offset2 = 0;
        for (const part of parts) {
            CanvasComparer.ctx2.fillText(part, offset2, 10);
            offset2 += CanvasComparer.ctx2.measureText(part).width;
        }

        if (offset1 !== offset2) {
            return false;
        }

        if (offset1 === 0) {
            return false;
        }

        const imageData1 = CanvasComparer.ctx1.getImageData(0, 0, offset2, 15);
        const imageData2 = CanvasComparer.ctx2.getImageData(0, 0, offset2, 15);

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
                //i = 0; // commenting out this might require grapheme clusters in the first place
                continue;
            }
            i++;
        }
        return parts;
    }
}
