import SetMap from '../data_structures/set_map';
import { AttributeObserver, type AttributeObserverDelegate } from './attribute_observer';

export type TokenListObserverDelegate<T> = {
  tokenMatched?: (token: Token<T>) => void;
  tokenUnmatched?: (token: Token<T>) => void;
};

export type Token<T> = {
  attributeName: string;
  content: string;
  element: T;
};

export class TokenListObserver<T extends Element = Element> implements AttributeObserverDelegate<T> {
  private elementTokens: SetMap<Element, Token<T>>;
  private attributeObserver?: AttributeObserver<T>;

  constructor(
    private readonly element: Element,
    private readonly attributeName: string,
    private delegate: TokenListObserverDelegate<T>
  ) {
    this.element = element;
    this.attributeName = attributeName;
    this.delegate = delegate;
    this.elementTokens = new SetMap();
  }

  start() {
    if (!this.attributeObserver) {
      this.attributeObserver = new AttributeObserver(this.element, this.attributeName, this);
      this.attributeObserver.start();
    }
  }

  stop() {
    if (this.attributeObserver) {
      this.attributeObserver.stop();
      this.attributeObserver = undefined;
    }
  }

  elementConnected(element: T) {
    const tokens = this.readTokensForElement(element);
    tokens.forEach((token) => this.tokenMatched(token));
  }

  elementDisconnected(element: T) {
    // Instead of removing the value, if we remove the attribute itself, the `readTokensForElement` will not return
    // any tokens. Hence, we need to get the tokens from the state.
    const tokens = this.elementTokens.getValuesForKey(element);
    tokens.forEach((token) => this.tokenUnmatched(token));
  }

  elementAttributeChanged(element: T) {
    const oldTokens = this.elementTokens.getValuesForKey(element);
    const newTokens = this.readTokensForElement(element);
    const [added, removed] = compareTokens(newTokens, oldTokens);
    removed.forEach((token) => this.tokenUnmatched(token));
    added.forEach((token) => this.tokenMatched(token));
  }

  private tokenMatched(token: Token<T>) {
    this.elementTokens.add(token.element, token);
    this.delegate.tokenMatched?.(token);
  }

  private tokenUnmatched(token: Token<T>) {
    this.elementTokens.delete(token.element, token);
    this.delegate.tokenUnmatched?.(token);
  }

  private readTokensForElement(element: T): Token<T>[] {
    const tokenString = element.getAttribute(this.attributeName) || '';
    return parseTokenString(tokenString, element, this.attributeName);
  }
}

function parseTokenString<T>(tokenString: string, element: T, attributeName: string): Token<T>[] {
  return tokenString
    .trim()
    .split(/\s+/)
    .filter((content) => content.length)
    .map((content) => ({ element, attributeName, content }));
}

function compareTokens<T>(newTokens: Token<T>[], oldTokens: Token<T>[]) {
  // Convert arrays to sets for O(1) lookup time
  const newTokensSet = new Set(newTokens.map(({ content }) => content));
  const oldTokensSet = new Set(oldTokens.map(({ content }) => content));

  const added = newTokens.filter((token) => !oldTokensSet.has(token.content));
  const removed = oldTokens.filter((token) => !newTokensSet.has(token.content));
  return [added, removed];
}
