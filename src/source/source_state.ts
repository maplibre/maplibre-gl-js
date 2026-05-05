import {extend} from '../util/util.ts';
import type {Tile} from '../tile/tile.ts';
import type {FeatureState} from '@maplibre/maplibre-gl-style-spec';
import type {InViewTiles} from '../tile/tile_manager_in_view_tiles.ts';
import type {Painter} from '../render/painter.ts';

export type FeatureStateEntry = {id: string; state: FeatureState};
export type FeatureStates = FeatureStateEntry[];
export type LayerFeatureStates = Record<string, FeatureStates>;

type FeatureStatesMap = Record<string, FeatureState>;
type LayerFeatureStatesMap = Record<string, FeatureStatesMap>;

function featureStatesMapToArray(map: FeatureStatesMap): FeatureStates {
    const result: FeatureStates = [];
    for (const id in map) {
        result.push({id, state: map[id]});
    }
    return result;
}

/**
 * @internal
 * SourceFeatureState manages the state and pending changes
 * to features in a source, separated by source layer.
 * stateChanges and deletedStates batch all changes to the tile (updates and removes, respectively)
 * between coalesce() events. addFeatureState() and removeFeatureState() also update their counterpart's
 * list of changes, such that coalesce() can apply the proper state changes while agnostic to the order of operations.
 * In deletedStates, all null's denote complete removal of state at that scope
*/
export class SourceFeatureState {
    state: LayerFeatureStatesMap;
    stateChanges: LayerFeatureStatesMap;
    deletedStates: {};
    revision: number;

    constructor() {
        this.state = {};
        this.stateChanges = {};
        this.deletedStates = {};
        this.revision = 0;
    }

    updateState(sourceLayer: string, featureId: number | string, newState: any): void {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] ||= {};
        this.stateChanges[sourceLayer][feature] ||= {};
        extend(this.stateChanges[sourceLayer][feature], newState);

        if (this.deletedStates[sourceLayer] === null) {
            this.deletedStates[sourceLayer] = {};
            for (const ft in this.state[sourceLayer]) {
                if (ft !== feature) this.deletedStates[sourceLayer][ft] = null;
            }
        } else {
            const featureDeletionQueued = this.deletedStates[sourceLayer]?.[feature] === null;
            if (featureDeletionQueued) {
                this.deletedStates[sourceLayer][feature] = {};
                for (const prop in this.state[sourceLayer][feature]) {
                    if (!newState[prop]) this.deletedStates[sourceLayer][feature][prop] = null;
                }
            } else {
                for (const key in newState) {
                    const deletionInQueue = this.deletedStates[sourceLayer]?.[feature]?.[key] === null;
                    if (deletionInQueue) delete this.deletedStates[sourceLayer][feature][key];
                }
            }
        }
    }

    removeFeatureState(sourceLayer: string, featureId?: number | string, key?: string): void {
        const sourceLayerDeleted = this.deletedStates[sourceLayer] === null;
        if (sourceLayerDeleted) return;

        const feature = String(featureId);

        this.deletedStates[sourceLayer] ||= {};

        if (key && featureId !== undefined) {
            if (this.deletedStates[sourceLayer][feature] !== null) {
                this.deletedStates[sourceLayer][feature] ||= {};
                this.deletedStates[sourceLayer][feature][key] = null;
            }
        } else if (featureId !== undefined) {
            const updateInQueue = this.stateChanges[sourceLayer]?.[feature];
            if (updateInQueue) {
                this.deletedStates[sourceLayer][feature] = {};
                for (key in this.stateChanges[sourceLayer][feature]) this.deletedStates[sourceLayer][feature][key] = null;

            } else {
                this.deletedStates[sourceLayer][feature] = null;
            }
        } else {
            this.deletedStates[sourceLayer] = null;
        }

    }

    getState(sourceLayer: string, featureId: number | string): FeatureState {
        const feature = String(featureId);
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};

        const reconciledState = extend({}, base[feature], changes[feature]);

        //return empty object if the whole source layer is awaiting deletion
        if (this.deletedStates[sourceLayer] === null) return {};
        else if (this.deletedStates[sourceLayer]) {
            const featureDeletions = this.deletedStates[sourceLayer][featureId];
            if (featureDeletions === null) return {};
            for (const prop in featureDeletions) delete reconciledState[prop];
        }
        return reconciledState;
    }

    initializeTileState(tile: Tile, painter: Painter): void {
        const layerStates: LayerFeatureStates = {};
        for (const sourceLayer in this.state) {
            layerStates[sourceLayer] = featureStatesMapToArray(this.state[sourceLayer]);
        }
        tile.setFeatureState(layerStates, painter);
    }

    coalesceChanges(inViewTiles: InViewTiles, painter: Painter): void {
        //track changes with full state objects, but only for features that got modified
        //use an intermediate object keyed by feature id to naturally deduplicate entries
        const featuresChangedMap: LayerFeatureStatesMap = {};

        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer] ||= {};
            featuresChangedMap[sourceLayer] ||= {};
            for (const feature in this.stateChanges[sourceLayer]) {
                this.state[sourceLayer][feature] ||= {};
                extend(this.state[sourceLayer][feature], this.stateChanges[sourceLayer][feature]);
                featuresChangedMap[sourceLayer][feature] = this.state[sourceLayer][feature];
            }
        }

        for (const sourceLayer in this.deletedStates) {
            this.state[sourceLayer] ||= {};
            featuresChangedMap[sourceLayer] ||= {};

            if (this.deletedStates[sourceLayer] === null) {
                for (const ft in this.state[sourceLayer]) {
                    this.state[sourceLayer][ft] = {};
                    featuresChangedMap[sourceLayer][ft] = {};
                }
            } else {
                for (const feature in this.deletedStates[sourceLayer]) {
                    const deleteWholeFeatureState = this.deletedStates[sourceLayer][feature] === null;
                    if (deleteWholeFeatureState) this.state[sourceLayer][feature] = {};
                    else {
                        for (const key of Object.keys(this.deletedStates[sourceLayer][feature])) {
                            delete this.state[sourceLayer][feature][key];
                        }
                    }
                    featuresChangedMap[sourceLayer][feature] = this.state[sourceLayer][feature];
                }
            }
        }

        this.stateChanges = {};
        this.deletedStates = {};

        if (Object.keys(featuresChangedMap).length === 0) return;

        this.revision++;

        const featuresChanged: LayerFeatureStates = {};
        for (const sourceLayer in featuresChangedMap) {
            featuresChanged[sourceLayer] = featureStatesMapToArray(featuresChangedMap[sourceLayer]);
        }

        inViewTiles.setFeatureState(featuresChanged, painter);
    }
}
