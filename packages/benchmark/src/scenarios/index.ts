import type { Scenario } from './scenario.ts';
import { attributesPlain, attributesTokened } from './attributes.ts';
import { bodySwap } from './body_swap.ts';
import { tableScenarios } from './table.ts';

export const scenarios: Scenario[] = [...tableScenarios, bodySwap, attributesPlain, attributesTokened];
