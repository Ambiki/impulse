import Store from '../store';

export interface PropertyType {
  key: string;
  type: PropertyConstructor;
}

export type PropertyConstructor =
  | StringConstructor |
  BooleanConstructor |
  NumberConstructor |
  ArrayConstructor |
  ObjectConstructor;

export function property({ type = String }: { type?: PropertyConstructor } = {}) {
  return (ctor: any, key: string) => {
    const store = new Store<PropertyType>(ctor, 'property');
    store.add({ key, type });
  };
}
