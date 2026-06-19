import { defineConfig } from 'vitepress';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/impulse/',
  title: 'Impulse',
  description: 'A JavaScript framework that leverages the Web Components API.',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/impulse/favicon.svg' }]],
  lastUpdated: true,
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
  vite: {
    plugins: [
      groupIconVitePlugin(),
      llmstxt({
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        // Makes the .md links in llms.txt absolute. The plugin already includes the site `base`
        // (/impulse/) in the paths, so the domain is the bare host without it.
        domain: 'https://ambiki.github.io',
        description: 'A lightweight JavaScript framework built on the Web Components API.',
        details: `\
Impulse augments your existing HTML with just enough JavaScript to make it interactive and reactive. \
Write your HTML however you like — server-rendered, static, or generated — and let Impulse handle the behavior. \
There is no virtual DOM and no JSX; it leans on progressive enhancement.

You write a custom element around your markup, then wire up behavior with a small set of building blocks:

- **Actions** bind event listeners declaratively via \`data-action\` attributes.
- **Targets** reference child elements by name via \`data-target\` attributes.
- **Properties** read and write HTML attributes, with change callbacks.
- **Lifecycle callbacks** run code when an element or target connects to or disconnects from the DOM.

A component _is_ its custom element, so its methods live on the DOM node and can be called from anywhere. \
Properties and targets are declared with first-class, typed TypeScript decorators.`,
      }),
    ],
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/favicon.svg',
    nav: [{ text: 'Home', link: '/' }],
    outline: 'deep',
    search: {
      provider: 'local',
    },
    sidebar: [
      {
        text: 'Introduction',
        collapsed: false,
        items: [
          { text: 'What is Impulse?', link: '/introduction/what-is-impulse' },
          { text: 'Getting started', link: '/introduction/getting-started' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Registering elements', link: '/reference/registering-elements' },
          { text: 'Lifecycle callbacks', link: '/reference/lifecycle-callbacks' },
          { text: 'Actions', link: '/reference/actions' },
          { text: 'Properties', link: '/reference/properties' },
          { text: 'Targets', link: '/reference/targets' },
        ],
      },
      {
        text: 'Utilities',
        collapsed: false,
        items: [
          { text: 'connected', link: '/utilities/connected' },
          { text: 'disconnected', link: '/utilities/disconnected' },
          { text: 'emit', link: '/utilities/emit' },
          { text: 'lazyImport', link: '/utilities/lazy-import' },
          { text: 'on', link: '/utilities/on' },
          { text: 'whenInitialized', link: '/utilities/when-initialized' },
        ],
      },
      {
        text: 'Examples',
        collapsed: false,
        items: [{ text: 'Clipboard element', link: '/examples/clipboard-element' }],
      },
    ],
    editLink: {
      pattern: 'https://github.com/Ambiki/impulse/tree/main/packages/docs/:path',
    },
    footer: {
      message: 'Released under the MIT License.',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Ambiki/impulse' }],
  },
  sitemap: {
    hostname: 'https://ambiki.github.io/impulse/',
  },
});
