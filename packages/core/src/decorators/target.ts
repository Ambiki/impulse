import Store from '../store';

export default function target() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'target');
    store.add({ key });
  };
}
