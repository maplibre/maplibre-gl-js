import replace from 'replace-in-file';

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Error: Path argument missing.');
    process.exit();
}

replace.sync({
    files: args,
    from: /import {test} from '..\/..\/util\/test';\n/g,
    to: '',
})

replace.sync({
  files: args,
  from: /\ntest/g,
  to: '\ndescribe',
});

replace.sync({
    files: args,
    from: /\(t\) =>/g,
    to: '() =>',
});

replace.sync({
    files: args,
    from: /t.end\(\);\n/g,
    to: '',
});

replace.sync({
    files: args,
    from: /t.pass\(\);/g,
    to: ''
});

replace.sync({
    files: args,
    from: /..\/..\/..\/rollup\/build\/tsc\/src\//g,
    to: '../',
});

replace.sync({
    files: args,
    from: /t.test\(/g,
    to: 'test('
})
