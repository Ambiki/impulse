import type { Browser } from 'playwright';
import type { Server } from '../src/runner/server.ts';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { buildCandidateImpulse, buildSite, sitesDir } from '../src/runner/build.ts';
import { TEST_WORK_DIR } from '../src/runner/paths.ts';
import { checkScenario } from '../src/runner/run.ts';
import { serve } from '../src/runner/server.ts';
import { scenarios } from '../src/scenarios/index.ts';

// A Scenario that silently stops exercising Impulse (a component never registers, a token names the wrong owner)
// would still produce fast, stable numbers. These checks run each Scenario once and inspect the page afterwards.
describe('Scenarios', () => {
  let browser: Browser;
  let server: Server;

  before(async () => {
    await buildSite('candidate', { module: await buildCandidateImpulse(TEST_WORK_DIR) }, TEST_WORK_DIR);
    await buildSite('control', 'none', TEST_WORK_DIR);
    server = await serve(sitesDir(TEST_WORK_DIR));
    browser = await chromium.launch();
  }, { timeout: 180_000 });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  for (const { name } of scenarios) {
    it(`${name} leaves every component started and wired on the Candidate`, async () => {
      assert.deepEqual(await checkScenario(browser, server.origin, 'candidate', name), []);
    });

    it(`${name} runs with no component defined on the Control`, async () => {
      assert.deepEqual(await checkScenario(browser, server.origin, 'control', name), []);
    });
  }
});
