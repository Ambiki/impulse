/**
 * Returns a promise that is fulfilled once the document is Parsed: on `DOMContentLoaded` while `readyState` is
 * `loading`, and on the next microtask after that.
 */
export function whenParsed() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    } else {
      resolve();
    }
  });
}

let dropsRemoval: boolean | undefined;

/**
 * Whether `container.replaceChildren(node)` leaves out the mutation record for `node` leaving its old parent when that
 * parent is inside a child the call removes. Chromium and WebKit deliver that record and then the container's; Firefox
 * (155) delivers only the container's. The browser is asked once, on a tree that is never in the document.
 */
export function replaceChildrenDropsRemoval(): boolean {
  if (dropsRemoval === undefined) {
    const container = document.createElement('div');
    const node = container.appendChild(document.createElement('div')).appendChild(document.createElement('div'));
    const observer = new MutationObserver(() => {});
    observer.observe(container, { childList: true, subtree: true });
    // A browser without the method cannot make the call that loses the record.
    container.replaceChildren?.(node);
    dropsRemoval = observer.takeRecords().length === 1;
    observer.disconnect();
  }
  return dropsRemoval;
}
