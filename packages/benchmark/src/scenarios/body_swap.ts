import type { Scenario } from './scenario.ts';
import { expectEqual, fixture, range, startedCount } from './fixtures.ts';

const SECTIONS = 24;
const COMPONENT_TAGS = ['nav-menu', 'drop-down', 'tab-list', 'form-field', 'modal-dialog'];
// One nav menu with 4 drop-downs, then per section a tab list, 2 drop-downs, and a modal dialog with 4 form fields.
const COMPONENTS = 5 + SECTIONS * 8;
const NAV_LINKS = 4 * 12;

interface NavMenu extends HTMLElement {
  links: HTMLAnchorElement[];
}

interface DropDown extends HTMLElement {
  open: boolean;
}

interface TabList extends HTMLElement {
  tabs: HTMLElement[];
  selectedIndex: number;
}

function dropDown(id: string, items: number, linkAttributes = ''): string {
  const links = range(1, items).map((item) => `<li><a href="#${id}-${item}"${linkAttributes}>Item ${item}</a></li>`);
  return (
    `<drop-down>` +
    `<button type="button" data-target="drop-down.button" data-action="click->drop-down#toggle">Menu ${id}</button>` +
    `<ul data-target="drop-down.panel">${links.join('')}</ul>` +
    `</drop-down>`
  );
}

// The menu's links sit inside drop-downs but belong to `<nav-menu>`, so routing each token walks past a nearer owner.
function header(): string {
  const menus = range(1, 4).map(
    (menu) =>
      `<li>${dropDown(`nav-${menu}`, 12, ' data-target="nav-menu.links" data-action="click->nav-menu#navigate"')}</li>`,
  );
  return `<header><nav-menu><ul>${menus.join('')}</ul></nav-menu></header>`;
}

function card(section: number, index: number): string {
  const facts = range(1, 4).map((fact) => `<li>Fact ${fact}</li>`);
  return (
    `<article><header><h3>Card ${section}.${index}</h3></header>` +
    `<p>A short summary of the card's content.</p><ul>${facts.join('')}</ul>` +
    `<footer><a href="#open">Open</a><a href="#share">Share</a></footer></article>`
  );
}

function tabList(section: number): string {
  const tabs = range(1, 3).map(
    (tab) => `<button type="button" role="tab" data-target="tab-list.tabs" data-action="click->tab-list#select">Tab ${tab}</button>`,
  );
  const panels = range(1, 3).map(
    (tab) => `<div role="tabpanel" data-target="tab-list.panels"><p>Panel ${section}.${tab}</p><p>More.</p><p>More.</p></div>`,
  );
  return `<tab-list><div role="tablist">${tabs.join('')}</div>${panels.join('')}</tab-list>`;
}

function modalDialog(section: number): string {
  const fields = range(1, 4).map(
    (field) =>
      `<form-field${field % 2 === 0 ? ' required' : ''}><label>Field ${field}</label>` +
      `<input data-target="form-field.input" data-action="input->form-field#validate blur->form-field#validate">` +
      `<small data-target="form-field.error"></small></form-field>`,
  );
  return (
    `<modal-dialog><div role="dialog" data-target="modal-dialog.dialog"><h2>Edit ${section}</h2><form>${fields.join('')}` +
    `<footer><button type="button" data-target="modal-dialog.closeButtons" data-action="click->modal-dialog#close">` +
    `Cancel</button><button type="submit">Save</button></footer></form></div></modal-dialog>`
  );
}

function section(index: number): string {
  const paragraphs = range(1, 3).map(() => `<p>Some <strong>plain</strong> text with <em>inline</em> markup.</p>`);
  const cards = range(1, 16).map((position) => card(index, position));
  const activity = range(1, 50).map((entry) => `<li><span>User ${entry}</span> <time>${entry}h ago</time></li>`);
  return (
    `<section><h2>Section ${index}</h2>${paragraphs.join('')}<div class="cards">${cards.join('')}</div>` +
    `${tabList(index)}${dropDown(`card-${index}-a`, 5)}${dropDown(`card-${index}-b`, 5)}${modalDialog(index)}` +
    `<ul class="activity">${activity.join('')}</ul></section>`
  );
}

function footer(): string {
  return `<footer><ul>${range(1, 60).map((link) => `<li><a href="#footer-${link}">Link ${link}</a></li>`).join('')}</ul></footer>`;
}

/** About 10,000 elements, mostly plain markup, with about 200 components of 5 kinds. */
const page = fixture(() => `${header()}<main>${range(1, SECTIONS).map(section).join('')}</main>${footer()}`);

function components(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(COMPONENT_TAGS.join(',')));
}

function verifyPage(body: HTMLElement): string[] {
  const problems: string[] = [];
  const all = components(body);
  expectEqual(problems, 'components', all.length, COMPONENTS);
  expectEqual(problems, 'components not started', all.length - startedCount(all), 0);
  const elements = body.getElementsByTagName('*').length;
  if (elements < 9_000 || elements > 11_000) problems.push(`elements: expected 9,000 to 11,000, got ${elements}`);

  expectEqual(problems, 'nav menu links', (body.querySelector('nav-menu') as NavMenu).links.length, NAV_LINKS);
  const menu = body.querySelector('main drop-down') as DropDown;
  menu.querySelector('button')!.click();
  expectEqual(problems, 'drop-down open after a click', menu.open, true);
  const tabs = body.querySelector('tab-list') as TabList;
  tabs.tabs[2].click();
  expectEqual(problems, 'tab list selectedIndex after a click', tabs.selectedIndex, 2);
  return problems;
}

let replacement: HTMLElement;
let replaced: HTMLElement[];

/** A Turbo-style visit: the whole `<body>` swapped for a fresh copy of the same page. */
export const bodySwap: Scenario = {
  name: 'body-swap',
  description:
    'An app page of about 10,000 elements, mostly plain markup, with about 200 components of 5 kinds (some nested ' +
    'inside others). Times document.body.replaceWith() swapping it for a fresh copy of the same page, as a Turbo visit ' +
    'does: every old component disconnects and every new one connects.',
  warmup: 5,
  measured: 10,
  setup() {
    document.body.replaceChildren(page());
    replacement = document.createElement('body');
    replacement.append(page());
    replaced = components(document.body);
  },
  run() {
    document.body.replaceWith(replacement);
  },
  teardown() {
    document.body.replaceChildren();
  },
  verifySetup: () => verifyPage(document.body),
  verify() {
    const problems = verifyPage(document.body);
    expectEqual(problems, 'replaced components still started', startedCount(replaced), 0);
    return problems;
  },
};
