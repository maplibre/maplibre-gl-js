// According to https://developer.mozilla.org/en-US/docs/Web/API/Performance/now,
// performance.now() should be accurate to 0.005ms. Set the minimum running
// time for a single measurement at 5ms, so that the error due to timer
// precision is < 0.1%.
const minTimeForMeasurement = 0.005 * 1000;

export type Measurement = {
    iterations: number;
    time: number;
};

class Benchmark {
    /**
     * The `setup` method is intended to be overridden by subclasses. It will be called once, prior to
     * running any benchmark iterations, and may set state on `this` which the benchmark later accesses.
     * If the setup involves an asynchronous step, `setup` may return a promise.
     */
    setup(): Promise<void> | void {}

    /**
     * The `bench` method is intended to be overridden by subclasses. It should contain the code to be
     * benchmarked. It may access state on `this` set by the `setup` function (but should not modify this
     * state). It will be called multiple times, the total number to be determined by the harness. If
     * the benchmark involves an asynchronous step, `bench` may return a promise.
     */
    bench(): Promise<void> | void {}

    /**
     * The `teardown` method is intended to be overridden by subclasses. It will be called once, after
     * running all benchmark iterations, and may perform any necessary cleanup. If cleaning up involves
     * an asynchronous step, `teardown` may return a promise.
     */
    teardown(): Promise<void> | void {}

    /**
     * The minimum number of measurements affects how many statistical observations can be made on the benchmark e.g,
     * 210 measurement `samples => 20` observations for regression because the sum of 1 to 20 = 210. See regression() in statistics.ts.
     * The minimum number of measurements also affects the runtime: more measurements means a longer running beanchmark.
     */
    public minimumMeasurements = 210;

    _elapsed: number;
    _measurements: Array<Measurement>;
    _iterationsPerMeasurement: number;
    _start: number;

    /**
     * Run the benchmark by executing `setup` once, sampling the execution time of `bench` some number of
     * times, and then executing `teardown`. Yields an array of execution times.
     */
    async run(): Promise<Array<Measurement>> {
        try {
            await this.setup();
            return this._begin();
        } catch (e) {
            // The bench run will break here but should at least provide helpful information:
            console.error(e);
        }
    }

    private _done() {
        return this._elapsed >= 500 && this._measurements.length > this.minimumMeasurements;
    }

    private _begin(): Promise<Array<Measurement>> {
        this._measurements = [];
        this._elapsed = 0;
        this._iterationsPerMeasurement = 1;
        this._start = performance.now();

        const bench = this.bench();
        if (bench instanceof Promise) {
            return bench.then(() => this._measureAsync());
        } else {
            return this._measureSync();
        }
    }

    private _measureSync(): Promise<Array<Measurement>> {
        // Avoid Promise overhead for sync benchmarks.
        while (true) {
            const time = performance.now() - this._start;
            this._elapsed += time;
            if (time < minTimeForMeasurement) {
                this._iterationsPerMeasurement++;
            } else {
                this._measurements.push({time, iterations: this._iterationsPerMeasurement});
            }
            if (this._done()) {
                return this._end();
            }
            this._start = performance.now();
            for (let i = this._iterationsPerMeasurement; i > 0; --i) {
                this.bench();
            }
        }
    }

    private async _measureAsync(): Promise<Array<Measurement>> {
        while (true) {
            const time = performance.now() - this._start;
            this._elapsed += time;
            if (time < minTimeForMeasurement) {
                this._iterationsPerMeasurement++;
            } else {
                this._measurements.push({time, iterations: this._iterationsPerMeasurement});
            }
            if (this._done()) {
                return this._end();
            }
            this._start = performance.now();
            for (let i = this._iterationsPerMeasurement; i > 0; --i) {
                await this.bench();
            }
        }
    }

    private async _end(): Promise<Array<Measurement>> {
        await this.teardown();
        return this._measurements;
    }
}

export default Benchmark;
