import {NullProto, extend} from '../util/util';
import Tile from './tile';
import type {FeatureState} from '@maplibre/maplibre-gl-style-spec';

export type FeatureStates = {[featureId: string]: FeatureState} & NullProto;
export type LayerFeatureStates = {[layer: string]: FeatureStates} & NullProto;

/**
 * SourceFeatureState manages the state and pending changes
 * to features in a source, separated by source layer.
 * stateChanges and deletedStates batch all changes to the tile (updates and removes, respectively)
 * between coalesce() events. addFeatureState() and removeFeatureState() also update their counterpart's
 * list of changes, such that coalesce() can apply the proper state changes while agnostic to the order of operations.
 * In deletedStates, all null's denote complete removal of state at that scope
 * @private
*/
class SourceFeatureState {
    state: LayerFeatureStates;
    stateChanges: LayerFeatureStates;
    deletedStates: {
        [layer: string]: null | { [featureId: string]: null | { [k: keyof FeatureState]: null } };
    };
    constructor() {
        this.state = {__proto__: null};
        this.stateChanges = {__proto__: null};
        this.deletedStates = {__proto__: null};
    }

    updateState(sourceLayer: string, featureId: number | string, newState: any) {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] ??= {__proto__: null};
        this.stateChanges[sourceLayer][feature] ??= {__proto__: null};
        extend(this.stateChanges[sourceLayer][feature], newState);

        if (this.deletedStates[sourceLayer] === null) {
            this.deletedStates[sourceLayer] = {__proto__: null};
            for (const ft in this.state[sourceLayer]) {
                if (ft !== feature) this.deletedStates[sourceLayer][ft] = null;
            }
        } else {
            const featureDeletionQueued = this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature] === null;
            if (featureDeletionQueued) {
                this.deletedStates[sourceLayer][feature] = {__proto__: null};
                for (const prop in this.state[sourceLayer][feature]) {
                    if (!newState[prop]) this.deletedStates[sourceLayer][feature][prop] = null;
                }
            } else {
                for (const key in newState) {
                    const deletionInQueue = this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature] && this.deletedStates[sourceLayer][feature][key] === null;
                    if (deletionInQueue) delete this.deletedStates[sourceLayer][feature][key];
                }
            }
        }
    }

    removeFeatureState(sourceLayer: string, featureId?: number | string, key?: string) {
        const sourceLayerDeleted = this.deletedStates[sourceLayer] === null;
        if (sourceLayerDeleted) return;

        const feature = String(featureId);

        this.deletedStates[sourceLayer] ??= {__proto__: null};

        if (key && featureId !== undefined) {
            if (this.deletedStates[sourceLayer][feature] !== null) {
                this.deletedStates[sourceLayer][feature] ??= {__proto__: null};
                this.deletedStates[sourceLayer][feature][key] = null;
            }
        } else if (featureId !== undefined) {
            const updateInQueue = this.stateChanges[sourceLayer] && this.stateChanges[sourceLayer][feature];
            if (updateInQueue) {
                this.deletedStates[sourceLayer][feature] = {__proto__: null};
                for (key in this.stateChanges[sourceLayer][feature]) this.deletedStates[sourceLayer][feature][key] = null;

            } else {
                this.deletedStates[sourceLayer][feature] = null;
            }
        } else {
            this.deletedStates[sourceLayer] = null;
        }

    }

    getState(sourceLayer: string, featureId: number | string) : FeatureState {
        const feature = String(featureId);
        const base = this.state[sourceLayer] ?? {__proto__: null};
        const changes = this.stateChanges[sourceLayer] ?? {__proto__: null};

        const reconciledState = extend({__proto__: null}, base[feature], changes[feature]);

        //return empty object if the whole source layer is awaiting deletion
        if (this.deletedStates[sourceLayer] === null) return {__proto__: null};
        else if (this.deletedStates[sourceLayer]) {
            const featureDeletions = this.deletedStates[sourceLayer][featureId];
            if (featureDeletions === null) return {__proto__: null};
            for (const prop in featureDeletions) delete reconciledState[prop];
        }
        return reconciledState;
    }

    initializeTileState(tile: Tile, painter: any) {
        tile.setFeatureState(this.state, painter);
    }

    coalesceChanges(tiles: {
        [_ in any]: Tile;
    }, painter: any) {
        //track changes with full state objects, but only for features that got modified
        const featuresChanged: LayerFeatureStates = {__proto__: null};

        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer] ??= {__proto__: null};
            const layerStates = {__proto__: null};
            for (const feature in this.stateChanges[sourceLayer]) {
                this.state[sourceLayer][feature] ??= {__proto__: null};
                extend(this.state[sourceLayer][feature], this.stateChanges[sourceLayer][feature]);
                layerStates[feature] = this.state[sourceLayer][feature];
            }
            featuresChanged[sourceLayer] = layerStates;
        }

        for (const sourceLayer in this.deletedStates) {
            this.state[sourceLayer] ??= {__proto__: null};
            const layerStates = {__proto__: null};

            if (this.deletedStates[sourceLayer] === null) {
                for (const ft in this.state[sourceLayer]) {
                    layerStates[ft] = {};
                    this.state[sourceLayer][ft] = {};
                }
            } else {
                for (const feature in this.deletedStates[sourceLayer]) {
                    const deleteWholeFeatureState = this.deletedStates[sourceLayer][feature] === null;
                    if (deleteWholeFeatureState) this.state[sourceLayer][feature] = {__proto__: null};
                    else {
                        for (const key of Object.keys(this.deletedStates[sourceLayer][feature])) {
                            delete this.state[sourceLayer][feature][key];
                        }
                    }
                    layerStates[feature] = this.state[sourceLayer][feature];
                }
            }

            featuresChanged[sourceLayer] ??= {__proto__: null};
            extend(featuresChanged[sourceLayer], layerStates);
        }

        this.stateChanges = {__proto__: null};
        this.deletedStates = {__proto__: null};

        if (Object.keys(featuresChanged).length === 0) return;

        for (const id in tiles) {
            const tile = tiles[id];
            tile.setFeatureState(featuresChanged, painter);
        }
    }
}

export default SourceFeatureState;
