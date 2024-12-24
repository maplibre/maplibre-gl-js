/**
 * Error message to use when framebuffer is incomplete
 */
export const FRAMEBUFFER_NOT_COMPLETE_ERROR = 'Framebuffer is not complete';

/**
 * Check if an error is a framebuffer not complete error
 * @param error - An error object
 * @returns - true if the error is a framebuffer not complete error
 */
export function isFramebufferNotCompleteError(error: Error): boolean {
    return error.message === FRAMEBUFFER_NOT_COMPLETE_ERROR;
}

/**
 * Use this when you need to create a framebuffer not complete error.
 * @returns An error object with the message "Framebuffer is not complete"
 */
export function createFramebufferNotCompleteError(): Error {
    return new Error(FRAMEBUFFER_NOT_COMPLETE_ERROR);
}
