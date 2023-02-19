import {Plugin} from 'rollup';

function replacer(key: string, value: any) {
    return (key === 'doc' || key === 'example' || key === 'sdk-support') ? undefined : value;
}

export default function minifyStyleSpec(): Plugin {
    return {
        name: 'minify-style-spec',
        transform: (source, id) => {
            if (!/reference[\\/]v[0-9]+\.json$/.test(id)) {
                return;
            }

            const spec = JSON.parse(source);

            delete spec['expression_name'];

            return {
                code: JSON.stringify(spec, replacer, 0),
                map: {mappings: ''}
            };
        }
    };
}
