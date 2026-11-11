import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// eslint-disable-next-line test/no-import-node-test -- The repo has no vitest, and this one file needs no browser.
import { describe, it } from 'node:test';
import { documentedOptions } from '../web-test-runner.profiles.js';

// The test profiles compile with the `tsconfig.json` that getting-started.md tells readers to use, so the documented
// setups are the ones CI builds. This keeps the two from drifting apart.

const guide = readFileSync(new URL('../../docs/introduction/getting-started.md', import.meta.url), 'utf8');

/** The `compilerOptions` of the `json` code block whose code-group tab is `label`. */
function documented(label) {
  const blocks = Array.from(guide.matchAll(/```json \[([^\]]+)\]\n([\s\S]*?)```/g));
  const block = blocks.find(([, blockLabel]) => blockLabel === label);
  assert.ok(block, `getting-started.md has no \`json [${label}]\` block`);
  return JSON.parse(block[2]).compilerOptions;
}

describe('getting-started.md', () => {
  it('documents the tsconfig the standard decorator profiles compile with', () => {
    assert.deepEqual(documented('Standard decorators'), documentedOptions('standard'));
  });

  it('documents the tsconfig the legacy decorator profile compiles with', () => {
    assert.deepEqual(documented('Legacy decorators'), documentedOptions('legacy'));
  });
});
