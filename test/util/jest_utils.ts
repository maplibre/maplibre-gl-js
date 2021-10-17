
export const equalWithPrecisionJest = (expected: number, actual: number, multiplier: number) => {
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;
    expect(actualRounded).toEqual(expectedRounded);
}
