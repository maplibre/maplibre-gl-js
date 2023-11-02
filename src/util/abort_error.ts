/**
 * An error message to use when an operation is aborted
 */
export const ABORT_ERROR = 'AbortError';

/**
 * Check if an error is an abort error
 * @param error - An error object
 * @returns - true if the error is an abort error
 */
export function isAbortError(error: Error): boolean {
    return error.message === ABORT_ERROR;
}

/**
 * Use this when you need to create an abort error.
 * @returns An error object with the message "AbortError"
 */
export function createAbortError(): Error {
    return new Error(ABORT_ERROR);
}
