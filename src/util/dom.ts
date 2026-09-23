import Point from '@mapbox/point-geometry';

type ScaleReturnValue = {
    x: number;
    y: number;
    boundingClientRect: DOMRect;
};

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

const ALLOWED_TAGS = new Set([
    'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'del', 'div', 'em', 'i', 'img', 'ins', 'kbd', 'li',
    'mark', 'ol', 'p', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'ul', 'var', 'wbr'
]);

const ALLOWED_ATTRIBUTES = new Set([
    'alt', 'class', 'datetime', 'dir', 'height', 'href', 'hreflang', 'lang', 'referrerpolicy', 'rel', 'role',
    'src', 'target', 'title', 'translate', 'type', 'width'
]);

const URL_ATTRIBUTES = new Set(['href', 'src']);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Relative URLs have to resolve against something before their protocol can be read. Only the protocol of the
 * result is used, so the base never leaks into the sanitized markup.
 */
const RELATIVE_URL_BASE = 'https://maplibre.invalid/';

type ElementInternals = {
    /** Only ever called with a name `getAttributeNames` just returned, so the attribute is always there. */
    getAttribute: (this: Element, qualifiedName: string) => string;
    getAttributeNames: Element['getAttributeNames'];
    querySelectorAll: (this: Element, selectors: string) => NodeListOf<Element>;
    remove: Element['remove'];
    removeAttribute: Element['removeAttribute'];
    localName: (this: Element) => string;
    namespaceURI: (this: Element) => string;
};

let elementInternals: ElementInternals;

/**
 * The `Element` members the sanitizer uses, read off the prototype rather than off the element it is looking at.
 * A form control named `children`, `remove` or `localName` shadows the same-named property of its own form element,
 * which would otherwise let untrusted markup pick what the sanitizer walking that tree sees.
 *
 * They are read on first use rather than when this module is loaded, since the module is also imported where there
 * is no DOM at all, such as during server side rendering.
 */
function getElementInternals(): ElementInternals {
    elementInternals ??= {
        getAttribute: Element.prototype.getAttribute,
        getAttributeNames: Element.prototype.getAttributeNames,
        querySelectorAll: Element.prototype.querySelectorAll,
        remove: Element.prototype.remove,
        removeAttribute: Element.prototype.removeAttribute,
        localName: Object.getOwnPropertyDescriptor(Element.prototype, 'localName').get as () => string,
        namespaceURI: Object.getOwnPropertyDescriptor(Element.prototype, 'namespaceURI').get as () => string
    };
    return elementInternals;
}

export class DOM {
    private static readonly docStyle = typeof window !== 'undefined' && window.document?.documentElement.style;

    private static userSelect: string;

    private static selectProp = !DOM.docStyle || 'userSelect' in DOM.docStyle ? 'userSelect' : 'webkitUserSelect';

    public static create<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string, container?: HTMLElement): HTMLElementTagNameMap[K] {
        const el = window.document.createElement(tagName);
        if (className !== undefined) el.className = className;
        if (container) container.appendChild(el);
        return el;
    }

    public static createNS(namespaceURI: string, tagName: string): Element {
        return window.document.createElementNS(namespaceURI, tagName);
    }

    public static disableDrag(): void {
        if (DOM.docStyle && DOM.selectProp) {
            DOM.userSelect = DOM.docStyle[DOM.selectProp];
            DOM.docStyle[DOM.selectProp] = 'none';
        }
    }

    public static enableDrag(): void {
        if (DOM.docStyle && DOM.selectProp) {
            DOM.docStyle[DOM.selectProp] = DOM.userSelect;
        }
    }

    // Suppress the next click, but only if it's immediate.
    private static suppressClickInternal(e) {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('click', DOM.suppressClickInternal, true);
    }

    public static suppressClick(): void {
        window.addEventListener('click', DOM.suppressClickInternal, true);
        window.setTimeout(() => {
            window.removeEventListener('click', DOM.suppressClickInternal, true);
        }, 0);
    }

    private static getScale(element: HTMLElement): ScaleReturnValue {
        const rect = element.getBoundingClientRect();
        return {
            x: (rect.width / element.offsetWidth) || 1,
            y: (rect.height / element.offsetHeight) || 1,
            boundingClientRect: rect,
        };
    }

    private static getPoint(el: HTMLElement, scale: ScaleReturnValue, e: MouseEvent | Touch): Point {
        const rect = scale.boundingClientRect;
        return new Point(
            // rect.left/top values are in page scale (like clientX/Y),
            // whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
            ((e.clientX - rect.left) / scale.x) - el.clientLeft,
            ((e.clientY - rect.top) / scale.y) - el.clientTop
        );
    }

    public static mousePos(el: HTMLElement, e: MouseEvent | Touch): Point {
        const scale = DOM.getScale(el);
        return DOM.getPoint(el, scale, e);
    }

    public static touchPos(el: HTMLElement, touches: TouchList): Point[] {
        const points: Point[] = [];
        const scale = DOM.getScale(el);
        for (const touch of touches) {
            points.push(DOM.getPoint(el, scale, touch));
        }
        return points;
    }

    /**
     * Sanitize an untrusted HTML string, such as the attribution a remote TileJSON asks the map to display.
     *
     * Only the elements in `ALLOWED_TAGS` and the attributes in `ALLOWED_ATTRIBUTES` survive; anything else is
     * dropped along with its subtree. An allow list is used rather than a list of known-dangerous markup because
     * the latter silently permits whatever it has not heard of yet, including markup added to HTML after it was
     * written.
     *
     * The sanitized nodes are returned rather than a string: serializing and re-parsing is not a round trip, so
     * a string result lets carefully nested markup mutate into a different - and no longer sanitized - tree.
     */
    public static sanitize(str: string): DocumentFragment {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, 'text/html');
        const body = doc.body;

        const {querySelectorAll, remove} = getElementInternals();
        for (const element of Array.from<Element>(querySelectorAll.call(body, '*'))) {
            if (DOM.isAllowedElement(element)) {
                DOM.removeDisallowedAttributes(element);
            } else {
                remove.call(element);
            }
        }

        const fragment = document.createDocumentFragment();
        fragment.append(...body.childNodes);
        return fragment;
    }

    /**
     * An element is allowed only when it is plain HTML markup on the allow list. Elements in the SVG and MathML
     * namespaces are rejected even when their local name is allowed, since foreign content follows different
     * parsing rules and is what makes most mutation attacks possible in the first place.
     */
    private static isAllowedElement(element: Element): boolean {
        const {namespaceURI, localName} = getElementInternals();
        return namespaceURI.call(element) === HTML_NAMESPACE && ALLOWED_TAGS.has(localName.call(element));
    }

    private static removeDisallowedAttributes(element: Element) {
        const {getAttributeNames, getAttribute, removeAttribute} = getElementInternals();
        for (const name of getAttributeNames.call(element)) {
            if (DOM.isAllowedAttribute(name, getAttribute.call(element, name))) continue;
            removeAttribute.call(element, name);
        }
    }

    /**
     * `href` and `src` are further restricted to the protocols in `ALLOWED_PROTOCOLS`, so that `javascript:` and
     * `data:` URLs cannot turn an otherwise harmless link or image into a script. The protocol is taken from a
     * parsed URL rather than matched against the raw string, since the URL parser is what the browser will apply
     * and it ignores tabs, newlines and leading control characters that a string comparison would trip over.
     */
    private static isAllowedAttribute(name: string, value: string): boolean {
        if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('aria-')) return false;
        if (!URL_ATTRIBUTES.has(name)) return true;
        try {
            return ALLOWED_PROTOCOLS.has(new URL(value, RELATIVE_URL_BASE).protocol);
        } catch {
            return false;
        }
    }
}
