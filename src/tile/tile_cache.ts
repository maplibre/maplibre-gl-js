
type BoundedLRUOptions<V> = {
    maxEntries?: number;
    onRemove?: (value: V) => void;
};

export class BoundedLRUCache<K, V> {
    private map: Map<K, V>;
    private maxEntries: number;
    private onRemove: (value: V) => void;

    constructor(options: BoundedLRUOptions<V> = {}) {
        this.maxEntries = options.maxEntries || 1000;
        this.onRemove = options.onRemove;
        this.map = new Map();
    }

    /**
     * Retrieves a value from the cache and marks it as most recently used by moving it to the end.
     */
    get(key: K): V | undefined {
        const value = this.map.get(key);
        if (value !== undefined) {
            // Move key to end (most recently used)
            this.map.delete(key);
            this.map.set(key, value);
        }
        return value;
    }

    /**
     * Adds or updates a value in the cache. If the key already exists, it removes the old entry first.
     * If adding would exceed the maximum size, it removes the oldest entry before adding.
     */
    set(key: K, value: V) {
        if (this.map.has(key)) {
            this.remove(key);
        } else if (this.map.size >= this.maxEntries) {
            this.removeOldest();
        }
        this.map.set(key, value);
    }

    /**
     * Updates the maximum number of entries allowed in the cache.
     * If the new size is smaller than the current number of entries, removes oldest entries until within limit.
     */
    setMaxSize(maxEntries: number) {
        this.maxEntries = maxEntries;
        while (this.map.size > this.maxEntries) {
            this.removeOldest();
        }
    }

    /**
     * Removes entries from the cache that don't satisfy the provided filter function.
     */
    filter(func: (value: V) => boolean) {
        for (const [key, value] of this.map.entries()) {
            if (!func(value)) {
                this.remove(key);
            }
        }
    }

    /**
     * Removes the least recently used entry from the cache.
     * The first key is the least recently used since get/set above places entries at the end.
     */
    removeOldest() {
        const iterator = this.map.keys().next();
        if (iterator.done) return;
        this.remove(iterator.value);
    }

    /**
     * Removes a specific entry from the cache and triggers the onRemove callback if configured.
     */
    remove(key: K) {
        const value = this.map.get(key);
        if (value === undefined) return;
        this.map.delete(key);
        this.onRemove?.(value);
    }

    /**
     * Removes all entries from the cache. If an onRemove callback is configured,
     * it will be called for each entry.
     */
    clear() {
        if (!this.onRemove) {
            this.map.clear();
            return;
        }

        const values = Array.from(this.map.values());
        this.map.clear();
        for (const value of values) {
            this.onRemove(value);
        }
    }

    /**
     * Returns an array of all keys currently in the cache in their current order.
     */
    getKeys(): K[] {
        return Array.from(this.map.keys());
    }

    /**
     * Returns the maximum number of entries allowed in the cache.
     */
    getMaxEntries(): number {
        return this.maxEntries;
    }
}
