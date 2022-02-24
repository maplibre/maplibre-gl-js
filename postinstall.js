import {execSync} from 'child_process';

execSync('npm run codegen && npm run generate-query-test-fixtures');
