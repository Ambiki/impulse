const symbol = Symbol.for('impulse');

export default class Store {
  private map: Map<string, Set<Record<string, unknown>>> = new Map();

  constructor(
    private ctor: any,
    private name: string
  ) {
    this.ctor = ctor;
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
    if (!Object.prototype.hasOwnProperty.call(this.ctor, symbol)) {
      this.ctor[symbol] = new Map();
    }

    this.map = this.ctor[symbol];
    if (this.map.has(this.name)) return;

    this.map.set(this.name, new Set<Record<string, unknown>>());
  }
}
