import Point from '@mapbox/point-geometry';

type ScaleReturnValue = {
    x: number;
    y: number;
    boundingClientRect: DOMRect;
};

export class DOM {
    private static readonly docStyle = typeof window !== 'undefined' && window.document && window.document.documentElement.style;

    private static userSelect: string;

    private static selectProp = !DOM.docStyle || 'userSelect' in DOM.docStyle ? 'userSelect' : 'webkitUserSelect';

    public static create<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string, container?: HTMLElement): HTMLElementTagNameMap[K] {
        const el = window.document.createElement(tagName);
        if (className !== undefined) el.className = className;
        if (container) container.appendChild(el);
        return el;
    }

    public static createNS(namespaceURI: string, tagName: string) {
        const el = window.document.createElementNS(namespaceURI, tagName);
        return el;
    }

    public static disableDrag() {
        if (DOM.docStyle && DOM.selectProp) {
            DOM.userSelect = DOM.docStyle[DOM.selectProp];
            DOM.docStyle[DOM.selectProp] = 'none';
        }
    }

    public static enableDrag() {
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

    public static suppressClick() {
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

    public static touchPos(el: HTMLElement, touches: TouchList) {
        const points: Point[] = [];
        const scale = DOM.getScale(el);
        for (let i = 0; i < touches.length; i++) {
            points.push(DOM.getPoint(el, scale, touches[i]));
        }
        return points;
    }

    /**
     * Sanitize an HTML string - this might not be enough to prevent all XSS attacks
     * Base on https://javascriptsource.com/sanitize-an-html-string-to-reduce-the-risk-of-xss-attacks/
     * (c) 2021 Chris Ferdinandi, MIT License, https://gomakethings.com
     */
    public static sanitize(str: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, 'text/html');
        const html = doc.body || document.createElement('body');
        const scripts = html.querySelectorAll('script');
        for (const script of scripts) {
            script.remove();
        }

        DOM.clean(html);

        return html.innerHTML;
    }

    /**
     * Check if the attribute is potentially dangerous
     */
    private static isPossiblyDangerous(name: string, value: string): boolean {
        const val = value.replace(/\s+/g, '').toLowerCase();
        if (['src', 'href', 'xlink:href'].includes(name)) {
            if (val.includes('javascript:') || val.includes('data:')) return true;
        }
        if (name.startsWith('on')) return true;
    }

    /**
	 * Remove dangerous stuff from the HTML document's nodes
	 * @param html - The HTML document
	 */
    private static clean(html: Element) {
        const nodes = html.children;
        for (const node of nodes) {
            DOM.removeAttributes(node);
            DOM.clean(node);
        }
    }

    /**
	 * Remove potentially dangerous attributes from an element
	 * @param elem - The element
	 */
    private static removeAttributes(elem: Element) {
        for (const {name, value} of elem.attributes) {
            if (!DOM.isPossiblyDangerous(name, value)) continue;
            elem.removeAttribute(name);
        }
    }
}
