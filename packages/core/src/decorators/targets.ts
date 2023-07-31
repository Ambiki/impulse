import Store from '../store';

export default function targets() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    const store = new Store(ctor, 'targets');
    store.add({ key });
  };
}
