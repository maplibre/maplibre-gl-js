import Benchmark from '../lib/benchmark';
import {getImage} from '../../../src/util/ajax';
import browser from '../../../src/util/browser';

export default class GetImageData extends Benchmark {
    image: CanvasImageSource;

    setup(): Promise<void> {
        const promise = new Promise<void>((resolve, reject) => {
            getImage({url: '/bench/data/sprite.png'}, (err, img) => {
                if (!err) {
                    this.image = img;
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
        return promise;
    }

    bench() {
        browser.getImageData(this.image);
    }

    teardown() {
    }
}
