export function naiveAssert(test: unknown, message?: string) {
    if (!test) throw new Error(message.toString());
}
