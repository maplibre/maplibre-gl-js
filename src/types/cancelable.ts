/**
 * A request that can be cancelled
 */
export type Cancelable = {
    cancel: () => void;
};
