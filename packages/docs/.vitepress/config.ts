import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/impulse/',
  title: 'Impulse',
  description: 'A JavaScript framework that leverages the Web Components API.',
  lastUpdated: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [{ text: 'Home', link: '/' }],
    outline: 'deep',
    search: {
      provider: 'local',
    },
    sidebar: [
      {
        text: 'Introduction',
        collapsed: false,
        items: [{ text: 'Getting started', link: '/introduction/getting-started' }],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Lifecycle callbacks', link: '/reference/lifecycle-callbacks' },
          { text: 'Actions', link: '/reference/actions' },
          { text: 'Properties', link: '/reference/properties' },
          { text: 'Targets', link: '/reference/targets' },
          { text: 'Lazy import', link: '/reference/lazy-import' },
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
});
