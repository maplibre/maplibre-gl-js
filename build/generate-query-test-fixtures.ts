const rootFixturePath = 'test/integration/';
const suitePath = 'query-tests';

import {generateFixtureJson} from '../test/integration/lib/generate-fixture-json.js';

await generateFixtureJson(rootFixturePath, suitePath);
