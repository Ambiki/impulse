import type { Token, TokenListWatcherDelegate } from './token_list_watcher';
import { invokeReporting } from '../helpers/errors';
import { invokeEach } from '../helpers/invoke_each';
import { flushMutations } from './document_observer';
import { watchTokenList } from './token_list_watcher';

/**
 * One document-wide `[attributeName]` token watcher shared by every subscribing element, so the per-mutation cost of
 * the document observer stays constant instead of growing with the number of live instances (each `watchTokenList`
 * call is another catch-all selector that every added node is matched against, plus a full document scan on start).
 *
 * Each token is routed to its *owner*: the closest ancestor (or self) of the token's element whose tag name is the
 * identifier `identifierFor` extracts from the token content. Tokens are remembered per owner whether or not it has
 * subscribed yet, so an element that subscribes later gets its already-present tokens replayed synchronously, and an
 * element that unsubscribes gets `tokenUnmatched` for everything it still owns. Both indexes are weak, so an owner that
 * never subscribes (a plain element named by a stray token) is not kept alive by the router.
 *
 * Subscribers must still validate the token themselves: routing only narrows by tag name, and a token whose identifier
 * is some other valid selector (`div`, `*`) is delivered to whatever that selector matches.
 */
export default class TokenRouter {
  private readonly delegates = new WeakMap<Element, TokenListWatcherDelegate<Element>>();
  private readonly tokensByOwner = new WeakMap<Element, Set<Token<Element>>>();
  private readonly ownerByToken = new WeakMap<Token<Element>, Element>();
  // `delegates` is a WeakMap and cannot be counted, so the live subscriptions are tallied by hand.
  private subscriberCount = 0;
  private stopWatching?: () => void;

  constructor(
    private readonly attributeName: string,
    private readonly identifierFor: (content: string) => string | undefined,
  ) {}

  /**
   * Routes `owner`'s tokens to `delegate`. Tokens already on the page are delivered synchronously, including those on
   * nodes inserted earlier in the same task. Returns a stop function that fires `tokenUnmatched` for every token the
   * owner still holds and then forgets the delegate; every token is reported and the subscription released even if the
   * delegate throws, and the first error is rethrown afterwards. Calling it again is a no-op.
   */
  subscribe<T extends Element>(owner: Element, delegate: TokenListWatcherDelegate<T>): () => void {
    if (this.delegates.has(owner)) {
      throw new Error(`<${owner.localName}> is already subscribed to the "${this.attributeName}" token router.`);
    }
    // The watcher only guarantees `Element`; a delegate narrowing the token type takes that on itself, exactly as it
    // did with `watchTokenList<T>`.
    const routed = delegate as unknown as TokenListWatcherDelegate<Element>;

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

    this.delegates.set(owner, routed);
    this.subscriberCount += 1;
    // `watchTokenList` wraps each token delivery in its own error reporting, so a throwing delegate is reported there.
    // The replay is the router's own delivery and needs the same isolation: one bad token must not hide the rest.
    for (const token of this.ownedTokens(owner)) {
      invokeReporting(() => routed.tokenMatched?.(token));
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.unsubscribe(owner, routed);
    };
  }

  private unsubscribe(owner: Element, delegate: TokenListWatcherDelegate<Element>) {
    this.delegates.delete(owner);
    this.subscriberCount -= 1;
    // The owner's tokens stay indexed: they are still in the document, and a later re-subscribe replays them. The
    // observer's removal records (or the count-zero teardown below) are what finally drop them.
    const owned = this.ownedTokens(owner);
    try {
      invokeEach(owned, (token) => delegate.tokenUnmatched?.(token));
    } finally {
      if (this.subscriberCount === 0) {
        const stopWatching = this.stopWatching;
        this.stopWatching = undefined;
        // Fires `tokenUnmatched` for every tracked token; no delegate is left to deliver to, so this only clears the
        // ownership index.
        stopWatching?.();
      }
    }
  }

  private tokenMatched(token: Token<Element>) {
    const owner = this.ownerOf(token);
    if (!owner) return;
    let owned = this.tokensByOwner.get(owner);
    if (!owned) {
      owned = new Set();
      this.tokensByOwner.set(owner, owned);
    }
    owned.add(token);
    this.ownerByToken.set(token, owner);
    this.delegates.get(owner)?.tokenMatched?.(token);
  }

  private tokenUnmatched(token: Token<Element>) {
    const owner = this.ownerByToken.get(token);
    if (!owner) return;
    this.ownerByToken.delete(token);
    const owned = this.tokensByOwner.get(owner);
    if (owned) {
      owned.delete(token);
      if (owned.size === 0) this.tokensByOwner.delete(owner);
    }
    this.delegates.get(owner)?.tokenUnmatched?.(token);
  }

  // A snapshot, so delegates that add or remove tokens while being replayed or torn down do not disturb the loop.
  private ownedTokens(owner: Element): Token<Element>[] {
    const owned = this.tokensByOwner.get(owner);
    return owned ? Array.from(owned) : [];
  }

  /**
   * The single place that decides which element a token belongs to: the nearest ancestor-or-self whose tag name is the
   * token's identifier. Delegates do not repeat this walk; they only verify the identifier is their own tag name.
   */
  private ownerOf(token: Token<Element>): Element | null {
    const identifier = this.identifierFor(token.content);
    if (!identifier) return null;
    // The identifier comes straight from markup; an unparsable one (`123`, `.x`) is simply not a tag name.
    try {
      return token.element.closest(identifier);
    } catch {
      return null;
    }
  }
}
