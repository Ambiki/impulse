import type { Scenario } from './scenario.ts';
import { attributesFallback, attributesPlain, attributesTokened } from './attributes.ts';
import { bodySwap } from './body_swap.ts';
import { tableScenarios } from './table.ts';
import { watcherScalingScenarios } from './watcher_scaling.ts';

export const scenarios: Scenario[] = [
  ...tableScenarios,
  ...watcherScalingScenarios,
  bodySwap,
  attributesPlain,
  attributesTokened,
  attributesFallback,
];
