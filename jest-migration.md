# jest migration

We want to migrate the unit tests from [tap](https://www.npmjs.com/package/tap) to [jest](https://www.npmjs.com/package/jest), not just because jest has almost 100x more weekly downloads than tap, but also because jest is more _delightful_.

Unit test for tap are saved in `test/unit` and use the rollup output. We will move the unit tests to the same folder as the source code they asses and make them import directly the typescript source files.

While migrating a test, keep in mind that someone has to review what you did. Make sure that your diffs will be easy to review and show up nicely in git and GitHub. In case of doubt it is better to make too many commits than too few.

## Steps

Install `jest-codemods` globally with:

```bash
npm install -g jest-codemods
```

We will migrate `symbol/anchor.test.js`. First move, rename to typescript, and commit:

```
git mv test/unit/symbol/anchor.test.js src/symbol/anchor.test.ts
git commit -m "Move and rename"
```


Run `jest-codemods`:

```
jest-codemods --force src/symbol/anchor.test.ts
> Babel
> Tape
> Yes, and I'm not afraid of false positive transformations
> Yes, use the globals provided by Jest (recommended)
```

Run our custom codemods script with:

```
node codemods.js src/**/*test.ts
```

Fix remaining typescript errors by hand.

Run jest with:

```
npm run test-jest
```

Fix lint with:

```
npm run lint -- --fix
```

Finish:

```
git add src/symbol/anchor.test.ts
git commit -m "Migrate symbol/anchor.test.js"
```

## After the migration to jest

Once we have migrated all tests to jest we should remove the helper script `codemods.js` and get rid of `replace-in-file` in `package.json`.
