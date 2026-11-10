import type { Token } from './token_list_watcher';
import { invokeReporting } from '../helpers/errors';
import { invokeEach } from '../helpers/invoke_each';
import { endDelivery, flushMutations, startDelivery } from './document_observer';
import { listedContents, watchTokenList } from './token_list_watcher';

/** What a router needs from a parsed token: the identifier naming its Owner's tag. */
export interface RoutedDescriptor {
  identifier: string | undefined;
}

/**
 * What a subscriber hears about the tokens routed to it, each with the descriptor parsed from it once, when it was
 * matched. The same descriptor comes with the token's `tokenUnmatched`.
 */
export interface TokenRouterDelegate<T extends Element, D extends RoutedDescriptor> {
  tokenMatched?: (token: Token<T>, descriptor: D) => void;
  tokenUnmatched?: (token: Token<T>, descriptor: D) => void;
}

interface Route<D> {
  owner: Element;
  descriptor: D;
}

interface Subscription<D extends RoutedDescriptor> {
  delegate: TokenRouterDelegate<Element, D>;
  // What the subscriber calls itself, its tag name lowercased, as an Impulse element's `identifier` does: the only
  // identifier its tokens are delivered for.
  identifier: string;
}

/**
 * One document-wide `[attributeName]` token watcher shared by every subscribing element, so the per-mutation cost of
 * the document observer stays constant instead of growing with the number of live instances (each `watchTokenList`
 * call is another catch-all selector that every added node is matched against, plus a full document scan on start).
 *
 * Each token is parsed with `parse` once, when it is matched, and indexed under the closest ancestor (or self) of its
 * element that the descriptor's identifier matches. It is delivered to that element only when the element has
 * subscribed and the identifier is its own name, its tag name lowercased, so a subscriber is handed only its own tokens,
 * with the descriptors parsed then, and needs to check neither; an identifier that is some other selector (`div.x`,
 * `:is(x-a)`, `X-A`) reaches no one. Tokens are remembered per element whether or not it has subscribed yet, so one that
 * subscribes later gets its already-present tokens replayed synchronously, and one that unsubscribes gets
 * `tokenUnmatched` for every token it still owns. The indexes are weak, so an element named by a stray token that never
 * subscribes is not kept alive by the router.
 */
export default class TokenRouter<D extends RoutedDescriptor> {
  private readonly subscriptions = new WeakMap<Element, Subscription<D>>();
  private readonly tokensByOwner = new WeakMap<Element, Set<Token<Element>>>();
  // Each indexed token's route: where it is indexed and the descriptor parsed from it when it was matched.
  private readonly routes = new WeakMap<Token<Element>, Route<D>>();
  // How many replays and teardowns are walking an owner's tokens. A delegate can unsubscribe the last other subscriber
  // part-way through one, and stopping the router then would drop the routes of the tokens still to be delivered, so it
  // stops only once no walk is running.
  private walking = 0;
  // `subscriptions` is a WeakMap and cannot be counted, so the live subscriptions are tallied by hand.
  private subscriberCount = 0;
  private stopWatching?: () => void;

  constructor(
    private readonly attributeName: string,
    private readonly parse: (content: string) => D,
  ) {}

  /**
   * Routes `owner`'s tokens to `delegate`. Tokens already on the page are delivered synchronously, including those on
   * nodes inserted earlier in the same task. Returns a stop function that fires `tokenUnmatched` for every token the
   * owner still holds and then forgets the delegate; every token is reported and the subscription released even if the
   * delegate throws, and the first error is rethrown afterwards. Calling it again is a no-op.
   */
  subscribe<T extends Element>(owner: Element, delegate: TokenRouterDelegate<T, D>): () => void {
    if (this.subscriptions.has(owner)) {
      throw new Error(`<${owner.localName}> is already subscribed to the "${this.attributeName}" token router.`);
    }
    // The watcher only guarantees `Element`; a delegate narrowing the token type takes that on itself, exactly as it
    // did with `watchTokenList<T>`.
    const routed = delegate as unknown as TokenRouterDelegate<Element, D>;

    // Register the delegate only after the index is current, so the initial scan / flush records ownership without
    // delivering and the replay below is the single delivery.
    if (this.stopWatching) {
      flushMutations();
    } else {
      this.stopWatching = watchTokenList(document.documentElement, this.attributeName, {
        tokenMatched: (token) => this.tokenMatched(token),
        tokenUnmatched: (token) => this.tokenUnmatched(token),
      });
    }

    const subscription: Subscription<D> = { delegate: routed, identifier: owner.tagName.toLowerCase() };
    this.subscriptions.set(owner, subscription);
    this.subscriberCount += 1;
    // `watchTokenList` wraps each token delivery in its own error reporting, so a throwing delegate is reported there.
    // The replay is the router's own delivery and needs the same isolation: one bad token must not hide the rest.
    const nested = startDelivery();
    this.walking += 1;
    try {
      for (const token of this.ownedTokens(owner)) {
        const { descriptor } = this.routes.get(token)!;
        if (descriptor.identifier === subscription.identifier) {
          invokeReporting(() => routed.tokenMatched?.(token, descriptor));
        }
      }
    } finally {
      this.walking -= 1;
      endDelivery(nested);
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.unsubscribe(owner, subscription);
    };
  }

  /**
   * Whether a scan of the document as it stands would route to `owner` a token on `element` whose descriptor `accepts`.
   * It parses what `element` lists each time it is asked. The index only catches up when the record that moved or
   * removed an element, or rewrote its attribute, is delivered, so part-way through a mutation batch it can be behind
   * what this answers.
   */
  routesTo(owner: Element, element: Element, accepts: (descriptor: D) => boolean): boolean {
    const identifier = owner.tagName.toLowerCase();
    return listedContents(element, this.attributeName).some((content) => {
      const descriptor = this.parse(content);
      return (
        descriptor.identifier === identifier &&
        accepts(descriptor) &&
        this.ownerFor(element, descriptor.identifier) === owner
      );
    });
  }

  private unsubscribe(owner: Element, { delegate, identifier }: Subscription<D>) {
    this.subscriptions.delete(owner);
    this.subscriberCount -= 1;
    // The owner's tokens stay indexed: they are still in the document, and a later re-subscribe replays them. The
    // observer's removal records (or the count-zero teardown below) are what finally drop them.
    const owned = this.ownedTokens(owner);
    const nested = startDelivery();
    this.walking += 1;
    try {
      invokeEach(owned, (token) => {
        const { descriptor } = this.routes.get(token)!;
        if (descriptor.identifier === identifier) delegate.tokenUnmatched?.(token, descriptor);
      });
    } finally {
      this.walking -= 1;
      try {
        if (this.subscriberCount === 0 && this.walking === 0) {
          const stopWatching = this.stopWatching;
          this.stopWatching = undefined;
          // Fires `tokenUnmatched` for every tracked token; no delegate is left to deliver to, so this only clears the
          // ownership index.
          stopWatching?.();
        }
      } finally {
        endDelivery(nested);
      }
    }
  }

  private tokenMatched(token: Token<Element>) {
    const descriptor = this.parse(token.content);
    const owner = this.ownerFor(token.element, descriptor.identifier);
    if (!owner) return;
    let owned = this.tokensByOwner.get(owner);
    if (!owned) {
      owned = new Set();
      this.tokensByOwner.set(owner, owned);
    }
    owned.add(token);
    this.routes.set(token, { owner, descriptor });
    const subscription = this.subscriptions.get(owner);
    if (subscription && descriptor.identifier === subscription.identifier) {
      subscription.delegate.tokenMatched?.(token, descriptor);
    }
  }

  private tokenUnmatched(token: Token<Element>) {
    const route = this.routes.get(token);
    if (!route) return;
    this.routes.delete(token);
    const { owner, descriptor } = route;
    const owned = this.tokensByOwner.get(owner);
    if (owned) {
      owned.delete(token);
      if (owned.size === 0) this.tokensByOwner.delete(owner);
    }
    const subscription = this.subscriptions.get(owner);
    if (subscription && descriptor.identifier === subscription.identifier) {
      subscription.delegate.tokenUnmatched?.(token, descriptor);
    }
  }

  // A snapshot, so delegates that add or remove tokens while being replayed or torn down do not disturb the loop.
  private ownedTokens(owner: Element): Token<Element>[] {
    const owned = this.tokensByOwner.get(owner);
    return owned ? Array.from(owned) : [];
  }

  /**
   * The single place that decides which element a token is indexed under: the nearest ancestor-or-self the identifier
   * matches. Whether it is delivered there is decided by comparing the identifier with the subscriber's own name, which
   * is computed once, as it subscribes, rather than for every token: for a plain tag name the two agree, and an
   * identifier that is some other selector matches an element it does not name.
   */
  private ownerFor(element: Element, identifier: string | undefined): Element | null {
    if (!identifier) return null;
    // The identifier comes straight from markup; an unparsable one (`123`, `.x`) is simply not a tag name.
    try {
      return element.closest(identifier);
    } catch {
      return null;
    }
  }
}
