import {test} from '../../util/test';
import group from '../../../rollup/build/tsc/style-spec/group_by_layout';

test('group layers whose ref properties are identical', (t) => {
    const a = {
        'id': 'parent',
        'type': 'line'
    };
    const b = {
        'id': 'child',
        'type': 'line'
    };
    expect(group([a, b], {})).toEqual([[a, b]]);
    expect(group([a, b], {})[0][0]).toBe(a);
    expect(group([a, b], {})[0][1]).toBe(b);
    t.end();
});

test('group does not group unrelated layers', (t) => {
    expect(group([
        {
            'id': 'parent',
            'type': 'line'
        },
        {
            'id': 'child',
            'type': 'fill'
        }
    ], {})).toEqual([
        [{
            'id': 'parent',
            'type': 'line'
        }], [{
            'id': 'child',
            'type': 'fill'
        }]
    ]);
    t.end();
});

test('group works even for differing layout key orders', (t) => {
    expect(group([
        {
            'id': 'parent',
            'type': 'line',
            'layout': {'a': 1, 'b': 2}
        },
        {
            'id': 'child',
            'type': 'line',
            'layout': {'b': 2, 'a': 1}
        }
    ], {})).toEqual([[
        {
            'id': 'parent',
            'type': 'line',
            'layout': {'a': 1, 'b': 2}
        },
        {
            'id': 'child',
            'type': 'line',
            'layout': {'b': 2, 'a': 1}
        }
    ]]);
    t.end();
});
