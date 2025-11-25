/**
 * An error message to use when an operation is aborted
 */
export const ABORT_ERROR = 'AbortError';

export class AbortError extends Error {
    name = ABORT_ERROR;

    constructor(messageOrError: string | Error = ABORT_ERROR) {
        super(messageOrError instanceof Error ? messageOrError.message : messageOrError);
        if (messageOrError instanceof Error && messageOrError.stack) {
            this.stack = messageOrError.stack;
        }
    }
}

/**
 * Check if an error is an abort error
 * @param error - An error object
 * @returns - true if the error is an abort error
 */
export function isAbortError(error: Error): boolean {
    return error.name === ABORT_ERROR;
}
