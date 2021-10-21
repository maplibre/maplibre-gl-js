import replace from 'replace-in-file';
import {execSync} from 'child_process';


const file = process.argv[process.argv.length - 1];
const useAsync = process.argv.includes('--async');
const automate = process.argv.includes('--auto');

if (process.argv.length === 1) {
    console.log('Error: Path argument missing.');
    process.exit();
}

if (automate) {
    let fileName = file.split('/').splice(-1)[0];
    execSync(`git branch ${fileName}`);
    let destinationFile = file.replace('test/unit', 'src');
    execSync(`git mv ${file} ${destinationFile}`);
    execSync('git commit -m "Move and rename"');
    file = destinationFile;
    execSync(`jest-codemods --force ${file}`);
    execSync(`git add ${file}`);
    execSync('git commit -m "Run jest-codemods"');
}

replace.sync({
    files: [file],
    from: /import {test} from '..\/..\/util\/test';\n/g,
    to: '',
})

replace.sync({
  files: [file],
  from: /\ntest/g,
  to: '\ndescribe',
});

replace.sync({
    files: [file],
    from: /\(t\) =>/g,
    to: useAsync ? 'done =>' : '() =>',
});

replace.sync({
    files: [file],
    from: /t.end\(\);\n/g,
    to: useAsync ? 'done();\n' : '',
});

replace.sync({
    files: [file],
    from: /t.pass\(\);/g,
    to: ''
});

replace.sync({
    files: [file],
    from: /..\/..\/..\/rollup\/build\/tsc\/src\//g,
    to: '../',
});

replace.sync({
    files: [file],
    from: /t.test\(/g,
    to: 'test('
});

if (automate) {
    execSync('npm run lint -- --fix');
    execSync(`git add ${file}`);
    execSync('git commit -m "Run custom codemods"');
}

