/**
 * A callback definition.
 *
 * @example
 * ```ts
 * asyncFunction((error, result) => {
 *      if (error) {
 *          // handle error
 *      } else if (result) {
 *          // handle success
 *      }
 * });
 * ```
 */
export type Callback<T> = (error?: Error | null, result?: T | null) => void;
