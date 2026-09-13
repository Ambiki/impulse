import SetMap from '../data_structures/set_map';
import { watchSelector } from './document_observer';

export interface Token<T> {
  attributeName: string;
  content: string;
  element: T;
}

export interface TokenListWatcherDelegate<T> {
  tokenMatched?: (token: Token<T>) => void;
  tokenUnmatched?: (token: Token<T>) => void;
}

/**
 * Watches the document for elements with `[attributeName]` and emits a `tokenMatched` callback for each whitespace-
 * separated token in the attribute value. Token additions and removals (via attribute changes) are diffed and emitted
 * incrementally.
 *
 * Only elements contained within `scope` (or the `scope` element itself) are tracked. The returned `stop` function
 * synchronously fires `tokenUnmatched` for every currently-tracked token before deregistering.
 */
export function watchTokenList<T extends Element = Element>(
  scope: Element,
  attributeName: string,
  delegate: TokenListWatcherDelegate<T>,
): () => void {
  const elementTokens = new SetMap<Element, Token<T>>();

  const stopWatching = watchSelector<T>(`[${attributeName}]`, {
    elementConnected(element) {
      if (!scope.contains(element)) return;
      const tokens = parseTokens(element, attributeName);
      for (const token of tokens) {
        elementTokens.add(element, token);
        delegate.tokenMatched?.(token);
      }
    },
    elementDisconnected(element) {
      const tracked = elementTokens.getValuesForKey(element);
      for (const token of tracked) {
        elementTokens.delete(element, token);
        delegate.tokenUnmatched?.(token);
      }
    },
    elementAttributeChanged(element, name) {
      if (name !== attributeName) return;
      if (!scope.contains(element)) return;
      const oldTokens = elementTokens.getValuesForKey(element);
      const newTokens = parseTokens(element, attributeName);
      const [added, removed] = diffTokens(newTokens, oldTokens);
      for (const token of removed) {
        elementTokens.delete(element, token);
        delegate.tokenUnmatched?.(token);
      }
      for (const token of added) {
        elementTokens.add(element, token);
        delegate.tokenMatched?.(token);
      }
    },
  });

  return () => {
    for (const element of elementTokens.keys) {
      const tokens = elementTokens.getValuesForKey(element);
      for (const token of tokens) {
        delegate.tokenUnmatched?.(token);
      }
    }
    elementTokens.clear();
    stopWatching();
  };
}

function parseTokens<T extends Element>(element: T, attributeName: string): Token<T>[] {
  const value = element.getAttribute(attributeName) || '';
  return value
    .trim()
    .split(/\s+/)
    .filter((content) => content.length)
    .map((content) => ({ element, attributeName, content }));
}

/**
 * Multiset diff: each old token is matched to at most one new token with the same content. Matched old tokens keep
 * their identity (so delegates can key state on the `Token` object); unmatched old tokens are removed and unmatched
 * new tokens are added. Duplicate contents are therefore counted, not collapsed.
 */
function diffTokens<T>(newTokens: Token<T>[], oldTokens: Token<T>[]): [Token<T>[], Token<T>[]] {
  const unmatchedOld = new SetMap<string, Token<T>>();
  for (const token of oldTokens) {
    unmatchedOld.add(token.content, token);
  }

  const added: Token<T>[] = [];
  for (const token of newTokens) {
    const [match] = unmatchedOld.getValuesForKey(token.content);
    if (match) {
      unmatchedOld.delete(token.content, match);
    } else {
      added.push(token);
    }
  }

  return [added, unmatchedOld.values];
}
