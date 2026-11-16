/**
 * The methods of a [`TrustedTypePolicy`](https://developer.mozilla.org/en-US/docs/Web/API/TrustedTypePolicy) that the library calls.
 */
export type TrustedTypesPolicy = {
    /** Receives the attribution of a source, which is sanitized after it is parsed. */
    createHTML: (input: string) => unknown;
    /** Receives the URL the workers start from, which is a `blob:` URL when the worker is on another origin. */
    createScriptURL: (input: string) => unknown;
};

let trustedTypesPolicy: TrustedTypesPolicy | undefined;

/**
 * Sets the policy the library creates its trusted values with, for a page that enforces
 * [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API).
 * Call it before creating a map.
 *
 * @param policy - A policy from `trustedTypes.createPolicy`, or `undefined` to remove it.
 * @example
 * ```ts
 * setTrustedTypesPolicy(trustedTypes.createPolicy('my-map', {
 *     createHTML: (html) => html,
 *     createScriptURL: (url) => {
 *         if (!new URL(url, location.href).href.startsWith(`${location.origin}/`)) throw new TypeError(`Blocked script URL ${url}`);
 *         return url;
 *     }
 * }));
 * ```
 */
export function setTrustedTypesPolicy(policy: TrustedTypesPolicy | undefined): void {
    trustedTypesPolicy = policy;
}

/** Returns the `TrustedHTML` the policy creates for `html`, typed as the string TypeScript's DOM types ask for. */
export function createTrustedHTML(html: string): string {
    return trustedTypesPolicy ? trustedTypesPolicy.createHTML(html) as string : html;
}

/** Returns the `TrustedScriptURL` the policy creates for `url`, typed as the string TypeScript's DOM types ask for. */
export function createTrustedScriptURL(url: string): string {
    return trustedTypesPolicy ? trustedTypesPolicy.createScriptURL(url) as string : url;
}
