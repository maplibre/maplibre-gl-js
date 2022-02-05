const rootFixturePath = 'test/integration/query/';
const suitePath = 'tests';

import {generateFixtureJson} from '../test/integration/query/generate-fixture-json';

await generateFixtureJson(rootFixturePath, suitePath);
