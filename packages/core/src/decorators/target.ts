import type ImpulseElement from '../element';

export default function target() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, key: string) => {
    (ctor.constructor as typeof ImpulseElement).registerTarget(key);
  };
}
