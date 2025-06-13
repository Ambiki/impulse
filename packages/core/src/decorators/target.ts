import Store from '../store';

export type TargetType = {
  key: string;
  multiple: boolean;
};

export function target() {
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'target');
    store.add({ key, multiple: false });
  };
}

export function targets() {
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'target');
    store.add({ key, multiple: true });
  };
}
