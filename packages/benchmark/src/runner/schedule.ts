/**
 * The order Rounds run in for one Scenario: the Variants in order, then reversed, and so on `rounds` times
 * (A B C, C B A, A B C, ...). Across each forward-and-back pair every Variant runs before and after every other one
 * equally often, so a slow drift in the machine (thermal throttling, a background job winding down) favours none of
 * them. An odd `rounds` leaves one forward sweep unpaired.
 */
export function schedule<T>(variants: readonly T[], rounds: number): T[] {
  const order: T[] = [];
  for (let sweep = 0; sweep < rounds; sweep++) {
    order.push(...(sweep % 2 === 0 ? variants : [...variants].reverse()));
  }
  return order;
}
