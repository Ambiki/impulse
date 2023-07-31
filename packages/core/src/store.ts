const symbol = Symbol.for('impulse');

export default class Store {
  private map: Map<string, Set<Record<string, unknown>>> = new Map();

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private proto: any,
    private name: string
  ) {
    this.proto = proto;
    this.name = name;
    this.initialize();
  }

  add(value: Record<string, unknown>) {
    this.value?.add(value);
  }

  get value() {
    return this.map.get(this.name);
  }

  private initialize() {
    if (!Object.prototype.hasOwnProperty.call(this.proto, symbol)) {
      this.proto[symbol] = new Map();
    }

    this.map = this.proto[symbol];
    if (this.map.has(this.name)) return;

    this.map.set(this.name, new Set<Record<string, unknown>>());
  }
}
