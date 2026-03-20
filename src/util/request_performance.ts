/**
 * @internal
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 */
export class RequestPerformance {
    private start: string;
    private end: string;
    private measure: string;

    constructor (url: string) {
        this.start = `${url}#start`;
        this.end = `${url}#end`;
        this.measure = url;

        performance.mark(this.start);
    }

    finish() {
        performance.mark(this.end);
        let resourceTimingData = performance.getEntriesByName(this.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            performance.measure(this.measure, this.start, this.end);
            resourceTimingData = performance.getEntriesByName(this.measure);

            // cleanup
            performance.clearMarks(this.start);
            performance.clearMarks(this.end);
            performance.clearMeasures(this.measure);
        }

        return resourceTimingData;
    }
}
