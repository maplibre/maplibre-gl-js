import type {Map} from '../ui/map';

export abstract class MapResource {
    isLoaded: boolean = false;

    protected constructor(
        public id: string,
        public map: Map,
    ) {}

    abstract load(_any?: never): Promise<void>;
    abstract unload(): void;

    async loadMapResource(): Promise<void> {
        this.isLoaded = true;
        await this.load();
    }

    unloadMapResource(): void {
        this.isLoaded = false;
        this.unload();
    }
}
