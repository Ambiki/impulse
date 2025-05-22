import SetMap from '../data_structures/set_map';
import { AttributeObserver, type AttributeObserverDelegate } from './attribute_observer';

export type TokenListObserverDelegate = {
  tokenMatched?: (token: Token) => void;
  tokenUnmatched?: (token: Token) => void;
};

export type Token = {
  attributeName: string;
  content: string;
  element: Element;
};

export class TokenListObserver implements AttributeObserverDelegate {
  private elementTokens: SetMap<Element, Token>;
  private attributeObserver?: AttributeObserver;

  constructor(
    private readonly element: Element,
    private readonly attributeName: string,
    private delegate: TokenListObserverDelegate
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

  elementConnected(element: Element) {
    const tokens = this.readTokensForElement(element);
    tokens.forEach((token) => this.tokenMatched(token));
  }

  elementDisconnected(element: Element) {
    // Instead of removing the value, if we remove the attribute itself, the `readTokensForElement` will not return
    // any tokens. Hence, we need to get the tokens from the state.
    const tokens = this.elementTokens.getValuesForKey(element);
    tokens.forEach((token) => this.tokenUnmatched(token));
  }

  elementAttributeChanged(element: Element) {
    const oldTokens = this.elementTokens.getValuesForKey(element);
    const newTokens = this.readTokensForElement(element);
    const [added, removed] = compareTokens(oldTokens, newTokens);
    removed.forEach((token) => this.tokenUnmatched(token));
    added.forEach((token) => this.tokenMatched(token));
  }

  private tokenMatched(token: Token) {
    this.elementTokens.add(token.element, token);
    this.delegate.tokenMatched?.(token);
  }

  private tokenUnmatched(token: Token) {
    this.elementTokens.delete(token.element, token);
    this.delegate.tokenUnmatched?.(token);
  }

  private readTokensForElement(element: Element): Token[] {
    const tokenString = element.getAttribute(this.attributeName) || '';
    return parseTokenString(tokenString, element, this.attributeName);
  }
}

function parseTokenString(tokenString: string, element: Element, attributeName: string): Token[] {
  return tokenString
    .trim()
    .split(/\s+/)
    .filter((content) => content.length)
    .map((content) => ({ element, attributeName, content }));
}

function compareTokens(newTokens: Token[], oldTokens: Token[]) {
  // Convert arrays to sets for O(1) lookup time
  const newTokensSet = new Set(newTokens.map(({ content }) => content));
  const oldTokensSet = new Set(oldTokens.map(({ content }) => content));

  const added = oldTokens.filter((token) => !newTokensSet.has(token.content));
  const removed = newTokens.filter((token) => !oldTokensSet.has(token.content));
  return [added, removed];
}
