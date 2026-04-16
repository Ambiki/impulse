const symbol = Symbol.for('impulse');

export default class Store<T extends object = Record<string, unknown>> {
  private map: Map<string, Set<T>> = new Map();

  constructor(
    private ctor: any,
    private name: string,
  ) {
    this.ctor = ctor;
    this.name = name;
    this.initialize();
  }

  add(value: T) {
    this.value?.add(value);
  }

  get value(): Set<T> | undefined {
    return this.map.get(this.name);
  }

  private initialize() {
    if (!Object.hasOwn(this.ctor, symbol)) {
      this.ctor[symbol] = new Map();
    }

    this.map = this.ctor[symbol];
    if (this.map.has(this.name)) return;

    this.map.set(this.name, new Set<T>());
  }
}
