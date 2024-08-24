import AttributeObserver from './attribute_observer';

type TokenListObserverDelegate = {
  tokenMatched?: (token: Token) => void;
  tokenUnmatched?: (token: Token) => void;
  tokenChanged?: (token: Token) => void;
};

export type Token = {
  attributeName: string;
  content: string;
  element: Element;
};

export default class TokenListObserver {
  private attributeObserver: AttributeObserver;

  constructor(
    private readonly element: Element,
    private readonly attributeName: string,
    private delegate: TokenListObserverDelegate
  ) {
    this.element = element;
    this.attributeName = attributeName;
    this.delegate = delegate;
    this.attributeObserver = new AttributeObserver(this.element, this.attributeName, this);
  }

  start() {
    this.attributeObserver.start();
  }

  stop() {
    this.attributeObserver.stop();
  }

  elementConnected(element: Element) {
    const tokens = this.readTokensForElement(element);
    tokens.forEach((token) => this.tokenMatched(token));
  }

  elementDisconnected(element: Element) {
    const tokens = this.readTokensForElement(element);
    tokens.forEach((token) => this.tokenUnmatched(token));
  }

  elementAttributeChanged(element: Element) {
    const tokens = this.readTokensForElement(element);
    tokens.forEach((token) => this.tokenChanged(token));
  }

  private tokenMatched(token: Token) {
    this.delegate.tokenMatched?.(token);
  }

  private tokenUnmatched(token: Token) {
    this.delegate.tokenUnmatched?.(token);
  }

  private tokenChanged(token: Token) {
    this.delegate.tokenChanged?.(token);
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
