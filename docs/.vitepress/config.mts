import { defineConfig } from 'vitepress'

// For GitHub Pages deployment under a repository subpath, uncomment and adjust:
// base: '/device-mockup-studio-docs/',

export default defineConfig({
  lang: 'en-US',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }]],
  title: 'Device Mockup Studio',
  titleTemplate: '%s | Device Mockup Studio',
  description:
    'Compose device mockups, animate your designs, and export them in your browser. A framework-free TypeScript toolkit with a 2D canvas renderer, an optional WebGL2 renderer, and modular subpath imports.',
  ignoreDeadLinks: [{ pattern: /^\/examples\// }],
  themeConfig: {
    logo: { src: '/icon.svg', alt: 'Device Mockup Studio' },
    siteTitle: 'Device Mockup Studio',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Features', link: '/FEATURES', activeMatch: /(FEATURES|DEVICE-ARTWORK|SPATIAL|MEDIA)/ },
      { text: 'API', link: '/API', activeMatch: '/(API|HEADLESS)' },
      {
        text: 'Project',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Publishing', link: '/PUBLISHING' },
          { text: 'Third-party notices', link: '/THIRD-PARTY' },
          { text: 'Studio (live demo)', link: 'https://bookklik-technologies.github.io/device-mockup-studio/' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Features & limitations', link: '/FEATURES' },
          { text: 'Media formats & export limits', link: '/MEDIA' },
          { text: 'Device artwork & catalog', link: '/DEVICE-ARTWORK' },
        ],
      },
      {
        text: '3D Rendering',
        items: [{ text: 'Spatial guide (geometry, lighting, glass)', link: '/SPATIAL' }],
      },
      {
        text: 'Integration',
        items: [
          { text: 'API & integration', link: '/API' },
          { text: 'Headless embedding & Node', link: '/HEADLESS' },
          { text: 'Publishing & versioning', link: '/PUBLISHING' },
          { text: 'Third-party notices', link: '/THIRD-PARTY' },
        ],
      },
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search docs' },
        },
      },
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/bookklik-technologies/device-mockup-studio',
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Bookklik Technologies',
    },
    outline: { level: [2, 3], label: 'On this page' },
    lastUpdated: true,
  },
})
