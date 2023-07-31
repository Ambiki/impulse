import Store from '../store';

export type PropertyType = {
  key: string;
  type: PropertyConstructor;
};

export type PropertyConstructor =
  | StringConstructor
  | BooleanConstructor
  | NumberConstructor
  | ArrayConstructor
  | ObjectConstructor;

export default function property({ type = String }: { type?: PropertyConstructor } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'property');
    store.add({ key, type });
  };
}
