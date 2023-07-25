export class RequestMock implements Partial<Request> {
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

class AbortControllerMock {
    public signal: AbortSignal;

    public abort() {}
}

export function setupFetchMock(): jest.Mock<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit], any> {
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        return <Response>{
            json: async () => null,
            arrayBuffer: async () => null,
            text: async () => null,
        };
    });

    global.AbortController = AbortControllerMock;
    global.Request = RequestMock as unknown as typeof Request;
    global.fetch = fetchMock;

    return fetchMock;
}
