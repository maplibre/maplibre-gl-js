import { FeatureIndex } from "./feature_index";


const multiPointGeoJson = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0],
            },
            properties: {
                id: "point1",
            },
        },
        {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 1],
            },
            properties: {
                id: "point2",
            },
        },
        {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [2, 2],
            },
            properties: {
                id: "point3",
            },
        },
    ],
} as GeoJSON.GeoJSON;

describe("FeatureIndex", () => {
    test("promoteId uses properties.id when not clustered and cluster_id when clustered", async () => {
        const worker = new GeoJSONWorkerSource(
            actor,
            new StyleLayerIndex([]),
            []
        );

        // Test with non-clustered data using promoteId
        await worker.loadData({
            source: "source1",
            data: JSON.stringify(multiPointGeoJson),
            promoteId: "id",
        } as LoadGeoJSONParameters);

        const nonClusteredData =
            (await worker.getData()) as GeoJSON.FeatureCollection;
        expect(nonClusteredData.features[0].id).toBe("point1");
        expect(nonClusteredData.features[1].id).toBe("point2");
        expect(nonClusteredData.features[2].id).toBe("point3");

        // Test with clustered data
        await worker.loadData({
            source: "source1",
            data: JSON.stringify(multiPointGeoJson),
            cluster: true,
            promoteId: "id",
        } as LoadGeoJSONParameters);

        const clusteredData =
            (await worker.getData()) as GeoJSON.FeatureCollection;
        // Clustered features should use cluster_id instead of promoted property id
        expect(clusteredData.features[0].id).toMatch(/\d+/); // cluster_id is typically a number
        expect(clusteredData.features[0].properties.cluster).toBe(true);
    });
});
