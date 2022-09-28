import resolveTokens from './resolve_tokens';

test('resolveToken', () => {
    expect('3 Fine Fields').toBe(resolveTokens({a: 3, b: 'Fine', c: 'Fields'}, '{a} {b} {c}'));

    // No tokens.
    expect(resolveTokens({}, 'Test')).toBe('Test');

    // Basic.
    expect(resolveTokens({name: 'Test'}, '{name}')).toBe('Test');
    expect(resolveTokens({name: 'Test'}, '{name}-suffix')).toBe('Test-suffix');

    // Undefined property.
    expect(resolveTokens({}, '{name}')).toBe('');
    expect(resolveTokens({}, '{name}-suffix')).toBe('-suffix');

    // Non-latin.
    expect(resolveTokens({city: '서울특별시'}, '{city}')).toBe('서울특별시');

    // Unicode up to 65535.
    expect(resolveTokens({text: '\ufff0'}, '{text}')).toBe('\ufff0');
    expect(resolveTokens({text: '\uffff'}, '{text}')).toBe('\uffff');

    // Non-string values cast to strings.
    expect(resolveTokens({name: 5000}, '{name}')).toBe('5000');
    expect(resolveTokens({name: -15.5}, '{name}')).toBe('-15.5');
    expect(resolveTokens({name: true}, '{name}')).toBe('true');

    // Non-string values cast to strings, with token replacement.
    expect(resolveTokens({name: 5000}, '{name}-suffix')).toBe('5000-suffix');
    expect(resolveTokens({name: -15.5}, '{name}-suffix')).toBe('-15.5-suffix');
    expect(resolveTokens({name: true}, '{name}-suffix')).toBe('true-suffix');

    // Special characters in token.
    expect(resolveTokens({'dashed-property': 'dashed'}, '{dashed-property}')).toBe('dashed');
    expect(resolveTokens({'HØYDE': 150}, '{HØYDE} m')).toBe('150 m');
    expect(
        resolveTokens({'$special:characters;': 'mapbox'}, '{$special:characters;}')
    ).toBe('mapbox');

});
