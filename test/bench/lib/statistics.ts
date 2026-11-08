import * as d3 from 'd3';

export type Summary = {
    mean: number;
    trimmedMean: number;
    variance: number;
    deviation: number;
    windsorizedDeviation: number;
    q1: number;
    q2: number;
    q3: number;
    iqr: number;
    argmin: number;
    min: number;
    argmax: number;
    max: number;
};

export function summaryStatistics(data: number[]): Summary {
    const variance = d3.variance(data);
    const sorted = data.slice().sort(d3.ascending);
    const [q1, q2, q3] = [.25, .5, .75].map((d) => d3.quantile(sorted, d));
    const mean = d3.mean(sorted);
    let min = [NaN, Infinity];
    let max = [NaN, -Infinity];
    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        if (s < min[1]) min = [i, s];
        if (s > max[1]) max = [i, s];
    }

    // 20% trimmed mean
    const [lowerQuintile, upperQuintile] = [.2, .8].map(d => d3.quantile(sorted, d));
    const trimmedMean = d3.mean(data.filter(d => d >= lowerQuintile && d <= upperQuintile));
    const windsorizedDeviation = d3.deviation(data.map(d =>
        d < lowerQuintile ? lowerQuintile :
            d > upperQuintile ? upperQuintile :
                d
    ));

    return {
        mean,
        trimmedMean,
        variance,
        deviation: Math.sqrt(variance),
        windsorizedDeviation,
        q1,
        q2,
        q3,
        iqr: q3 - q1,
        argmin: min[0], // index of minimum value
        min: min[1],
        argmax: max[0], // index of maximum value
        max: max[1]
    };
}


