import Store from '../store';

export type TargetType = {
  key: string;
  multiple: boolean;
};

export function target() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'target');
    store.add({ key, multiple: false });
  };
}

export function targets() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'target');
    store.add({ key, multiple: true });
  };
}
