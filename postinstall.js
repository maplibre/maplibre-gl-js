import {execSync} from 'child_process';

if (process.env.NODE_ENV !== 'production') {
    execSync('npm run codegen && npm run generate-query-test-fixtures && husky install');
}
