import { ImpulseElement, property, registerElement, target, targets } from '@ambiki/impulse';

// The components of the `body-swap` page: small, typical widgets whose handlers only record that they ran.

@registerElement('nav-menu')
export class NavMenuElement extends ImpulseElement {
  @targets() links: HTMLAnchorElement[];

  navigate(event: Event) {
    event.preventDefault();
  }
}

@registerElement('drop-down')
export class DropDownElement extends ImpulseElement {
  @property({ type: Boolean }) open = false;
  @target() button: HTMLButtonElement;
  @target() panel: HTMLElement;

  toggle() {
    this.open = !this.open;
  }
}

@registerElement('tab-list')
export class TabListElement extends ImpulseElement {
  @targets() tabs: HTMLElement[];
  @targets() panels: HTMLElement[];

  selectedIndex = 0;

  select(event: Event) {
    this.selectedIndex = this.tabs.indexOf(event.currentTarget as HTMLElement);
  }
}

@registerElement('form-field')
export class FormFieldElement extends ImpulseElement {
  @property({ type: Boolean }) required = false;
  @target() input: HTMLInputElement;
  @target() error: HTMLElement;

  validate() {
    this.error.textContent = this.required && !this.input.value ? 'Required' : '';
  }
}

@registerElement('modal-dialog')
export class ModalDialogElement extends ImpulseElement {
  @target() dialog: HTMLElement;
  @targets() closeButtons: HTMLButtonElement[];

  closed = false;

  close() {
    this.closed = true;
  }
}
