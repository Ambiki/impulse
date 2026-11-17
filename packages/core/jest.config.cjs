// The testing entry point's tests in jsdom, where Jest suites run, and as Jest in its default mode runs them: the test
// files' imports of `../../src` and `../../src/testing` load the build through `require`, as `@ambiki/impulse` and
// `@ambiki/impulse/testing`, so the build has to exist (`yarn build`). Impulse's own suite runs in browsers only.

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test/testing'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '\\.[cm]?[jt]s$': '<rootDir>/test/jsdom/transform.cjs',
  },
  // The build is loaded as published, untransformed. Chai is only published as ES modules.
  transformIgnorePatterns: ['/node_modules/(?!@esm-bundle/chai/)', '<rootDir>/dist/'],
  moduleNameMapper: {
    '^@open-wc/testing$': '<rootDir>/test/jsdom/open_wc_testing.ts',
    '^\\.\\./\\.\\./src$': '@ambiki/impulse',
    '^\\.\\./\\.\\./src/testing$': '@ambiki/impulse/testing',
    // The `browser` export condition jsdom sets picks Sinon's ES module build.
    '^sinon$': require.resolve('sinon'),
  },
};
