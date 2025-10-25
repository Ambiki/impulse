import { connected } from './lifecycle';

/**
 * Sets up an event listener that automatically attaches to elements matching the selector.
 *
 * This function observes the DOM and automatically adds event listeners to elements matching
 * the provided CSS selector. Event listeners are added to existing elements immediately and
 * to new elements as they're added to the DOM. When elements are removed or no longer match
 * the selector, their event listeners are automatically cleaned up.
 *
 * @param eventName - The name of the event to listen for (e.g., 'click', 'focus', 'custom-event')
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when the event occurs. Receives the event.
 * @param options - Optional event listener options (capture, once, passive, etc.)
 * @returns A cleanup function that removes all event listeners and stops observing
 *
 * @example
 * ```ts
 * // Listen for clicks on all buttons with inferred types
 * on('click', 'button', (event) => {
 *   console.log('Button clicked:', event.currentTarget);
 * });
 *
 * // Use event listener options
 * on('click', '.once-button', (event) => {
 *   console.log('Clicked once');
 * }, { once: true });
 *
 * // Manual cleanup
 * const stop = on('click', 'button', (event) => {
 *   console.log('Clicked');
 * });
 * stop();
 * ```
 */
// Tag name selector with inferred event type: on('click', 'button', ...)
export function on<E extends keyof HTMLElementEventMap>(
  eventName: E,
  selector: string,
  callback: (event: HTMLElementEventMap[E]) => void,
  options?: boolean | AddEventListenerOptions
): () => void;
// Tag name selector with custom event type: on<CustomEvent, 'form'>('ajax', 'form', ...)
export function on<Ev extends Event>(
  eventName: string,
  selector: string,
  callback: (event: Ev) => void,
  options?: boolean | AddEventListenerOptions
): () => void;
export function on(
  eventName: string,
  selector: string,
  callback: (event: Event) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  return connected(selector, (element) => {
    element.addEventListener(eventName, callback, options);
    return () => {
      element.removeEventListener(eventName, callback, options);
    };
  });
}

/**
 * Dispatches a custom event from the specified target element.
 *
 * This is a convenience function for creating and dispatching CustomEvents with typed detail data.
 * Events are created with `bubbles: true` and `composed: true` by default, allowing them to
 * propagate through the DOM and cross shadow DOM boundaries.
 *
 * @param target - The element, window, or document to dispatch the event from
 * @param eventName - The name of the custom event
 * @param options - CustomEvent options including detail data and event configuration
 * @returns The CustomEvent that was dispatched
 *
 * @example
 * ```ts
 * // Dispatch a simple custom event
 * const button = document.querySelector('button');
 * emit(button, 'custom-click', { detail: { count: 1 } });
 *
 * // Dispatch with typed detail data
 * interface FormData {
 *   username: string;
 *   email: string;
 * }
 * const form = document.querySelector('form');
 * emit<FormData>(form, 'form-submit', {
 *   detail: { username: 'john', email: 'john@example.com' }
 * });
 *
 * // Dispatch without bubbling
 * emit(element, 'local-event', {
 *   detail: { message: 'Hello' },
 *   bubbles: false
 * });
 *
 * // Dispatch and access the event object
 * const event = emit(element, 'my-event', { detail: { success: true } });
 * console.log(event.defaultPrevented);
 * ```
 */
export function emit<T extends Record<string, any>>(
  target: Element | Window | Document,
  eventName: string,
  { detail = {} as T, ...rest }: CustomEventInit<T> = {}
) {
  const event = new CustomEvent(eventName, { bubbles: true, composed: true, detail, ...rest });
  target.dispatchEvent(event);
  return event;
}
