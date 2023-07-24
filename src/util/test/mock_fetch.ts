class RequestMock implements Partial<Request> {
    public readonly cache: RequestCache;
    public readonly headers: Headers = new Headers();
    public readonly method?: string;
    public readonly url?: string;

    public get signal(): AbortSignal {
        return null;
    }

    constructor(input: RequestInfo | URL, init?: RequestInit) {
        this.cache = typeof input === 'object' && 'cache' in input ? input.cache : init.cache;
        this.method = typeof input === 'object' && 'method' in input ? input.method : init.method;
        this.url = typeof input === 'object' && 'url' in input ? input.url : input.toString();
        this.headers = typeof input === 'object' && 'headers' in input ? new Headers(input.headers) : new Headers(init.headers || {});
    }
}

class AbortController {
    public signal: AbortSignal;

    public abort() {}
}

export function setupFetchMock() {
    global.AbortController = AbortController;
    global.Request = RequestMock as unknown as typeof Request;

    global.fetch = jest.fn(() => {
        return Promise.resolve(<Response>{
            json: () => null,
        });
    });
}
