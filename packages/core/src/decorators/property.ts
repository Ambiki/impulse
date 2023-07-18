import type ImpulseElement from '../element';

export type PropertyConstructor =
  | StringConstructor
  | BooleanConstructor
  | NumberConstructor
  | ArrayConstructor
  | ObjectConstructor;

export default function property({ type = String }: { type?: PropertyConstructor } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any, name: string) => {
    (ctor.constructor as typeof ImpulseElement).addProperty(name, { type });
  };
}
