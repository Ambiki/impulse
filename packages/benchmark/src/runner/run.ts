import type { Browser } from 'playwright';
import type { PageMode } from '../protocol.ts';
import type { Variant } from './build.ts';
import { RESULT_PROPERTY, scenarioQuery } from '../protocol.ts';

/** Loads a fresh page of `variant`, runs one Round of `scenario`, and returns the measured Iteration durations. */
export function runRound(browser: Browser, origin: string, variant: Variant, scenario: string): Promise<number[]> {
  return pageResult(browser, pageUrl(origin, variant, scenario, 'auto'));
}

/** Runs `scenario` once on a fresh page of `variant` and returns the problems the page reports. */
export function checkScenario(browser: Browser, origin: string, variant: Variant, scenario: string): Promise<string[]> {
  return pageResult(browser, pageUrl(origin, variant, scenario, 'check'));
}

function pageUrl(origin: string, variant: Variant, scenario: string, mode: PageMode): string {
  return `${origin}/${variant}/index.html${scenarioQuery(scenario, mode)}`;
}

// A context per page, so nothing (cache, storage, a still-running observer) carries over from the previous Round.
async function pageResult<T>(browser: Browser, url: string): Promise<T> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await page.goto(url);
    const result = await page.evaluate<T>(`window.${RESULT_PROPERTY}`);
    if (errors.length > 0) throw errors[0];
    if (result === undefined) throw new Error(`${url} did not start a Round.`);
    return result;
  } finally {
    await context.close();
  }
}
