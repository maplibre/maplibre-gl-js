import Point from '@mapbox/point-geometry';

export default class DOM {
    private static readonly docStyle = typeof window !== 'undefined' && window.document && window.document.documentElement.style;

    private static userSelect: string;

    private static selectProp = DOM.testProp(['userSelect', 'MozUserSelect', 'WebkitUserSelect', 'msUserSelect']);

    private static transformProp = DOM.testProp(['transform', 'WebkitTransform']);

    private static testProp(props: string[]): string {
        if (!DOM.docStyle) return props[0];
        for (let i = 0; i < props.length; i++) {
            if (props[i] in DOM.docStyle) {
                return props[i];
            }
        }
        return props[0];
    }

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

    public static setTransform(el: HTMLElement, value: string) {
        el.style[DOM.transformProp] = value;
    }

    public static addEventListener(target: any, type: any, callback: any, options: {
        passive?: boolean;
        capture?: boolean;
    } = {}) {
        if ('passive' in options) {
            target.addEventListener(type, callback, options);
        } else {
            target.addEventListener(type, callback, options.capture);
        }
    }

    public static removeEventListener(target: any, type: any, callback: any, options: {
        passive?: boolean;
        capture?: boolean;
    } = {}) {
        if ('passive' in options) {
            target.removeEventListener(type, callback, options);
        } else {
            target.removeEventListener(type, callback, options.capture);
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

    public static mousePos(el: HTMLElement, e: MouseEvent | Touch) {
        const rect = el.getBoundingClientRect();
        return new Point(
            e.clientX - rect.left - el.clientLeft,
            e.clientY - rect.top - el.clientTop
        );
    }

    public static touchPos(el: HTMLElement, touches: TouchList) {
        const rect = el.getBoundingClientRect();
        const points: Point[] = [];
        for (let i = 0; i < touches.length; i++) {
            points.push(new Point(
                touches[i].clientX - rect.left - el.clientLeft,
                touches[i].clientY - rect.top - el.clientTop
            ));
        }
        return points;
    }

    public static mouseButton(e: MouseEvent) {
        return e.button;
    }

    public static remove(node: HTMLElement) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
}
