export default function registerElement(name: string) {
  return (ctor: any) => {
    try {
      window.customElements.define(name, ctor);
      // @ts-expect-error Register
      window[ctor.name] = customElements.get(name);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'NotSupportedError')) throw error;
    }
  };
}
