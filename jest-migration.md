# jest migration

We want to migrate the unit tests from [tap](https://www.npmjs.com/package/tap) to [jest](https://www.npmjs.com/package/jest), not just because jest has almost 100x more weekly downloads than tap, but also because jest is more _delightful_.

Unit test for tap are saved in `test/unit` and use the rollup output. We will move the unit tests to the same folder as the source code they asses and make them import directly the typescript source files.

While migrating a test, keep in mind that someone has to review what you did. Make sure that your diffs will be easy to review and show up nicely in git and GitHub. In case of doubt it is better to make too many commits than too few.

## Steps

Manual steps can be seen below, if you would like a script to do is automatically use the following:

`node codemods.js --auto test/unit/symbol/anchor.test.js`
It will create a branch, move ot it, rename file, run code change and commit with the relavant messages...

### Manual steps

We will migrate `symbol/anchor.test.js`. First move, rename to typescript, and commit:

```
git mv test/unit/symbol/anchor.test.js src/symbol/anchor.test.ts
git commit -m "Move and rename"
```


Run `jest-codemods`:

```
npx jest-codemods --force src/symbol/anchor.test.ts
> Babel
> Tape
> Yes, and I'm not afraid of false positive transformations
> Yes, use the globals provided by Jest (recommended)
```

Run

```
git add src/symbol/anchor.test.ts
git commit -m "Run jest-codemods"
```

If there are no async tests in the file you are migrating run the custom codemods script with:

```
node codemods.js src/symbol/anchor.test.ts
```

Otherwise, if there are async tests, use:

```
node codemods.js --async src/symbol/anchor.test.ts
```

Lint and commit

```
npm run lint -- --fix
git add src/symbol/anchor.test.ts
git commit -m "Run custom codemods"
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

Once we have migrated all tests to jest we should remove the helper script `codemods.js` and get rid of `replace-in-file`, `jest-codemods` and `jscodeshift` in `package.json`.
