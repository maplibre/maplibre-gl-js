const rootFixturePath = 'test/integration/query/';
const suitePath = 'tests';

import {generateFixtureJson} from '../test/integration/query/generate-fixture-json.js';

await generateFixtureJson(rootFixturePath, suitePath);
