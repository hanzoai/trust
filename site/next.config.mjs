// Plain .mjs, not next.config.ts — deliberately.
//
// Next loads a TypeScript config through the TypeScript compiler API, so a .ts
// config would make config LOADING depend on which TypeScript is installed.
// TypeScript 7 (the native Go compiler) ships no JS API, so under it every
// `@/…` import stops resolving and the type-check step silently disappears. As
// ESM there is nothing to resolve: Next reads this file natively and the type
// comes from the JSDoc annotation.

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  // The shell is prerendered; the trust centre itself is one public GET made in
  // the browser, so there is no server here at all — just files.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,

  // @hanzo/gui and the component layer on top of it ship untranspiled ESM that
  // still names `react-native`. On web that name IS react-native-web, which is
  // the alias below; `transpilePackages` is what makes Next compile the source
  // rather than hand raw ESM to the server runtime.
  transpilePackages: ['@hanzo/gui', '@hanzo/ui', '@hanzogui/config', 'react-native-web'],

  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      'react-native$': 'react-native-web',

      // react-native-svg's WEB build reaches for `getAssetByID` from
      // @react-native/assets-registry — a package it does not declare and that
      // only resolves when React Native itself is hoisted beside it. It is the
      // asset table for numeric `require('./x.png')` handles, which is a
      // packager idea; on web the same table is react-native-web's, exporting
      // the same two functions. Installing the real one instead does not work:
      // 0.87 re-exports `AssetRegistry` from `react-native`, which the alias
      // above has already pointed at react-native-web, and that name is not
      // there — "Cannot read properties of undefined (reading 'registerAsset')"
      // at prerender.
      '@react-native/assets-registry/registry': 'react-native-web/dist/modules/AssetRegistry',
    };

    // PREPEND the web extensions. A react-native package publishes `Foo.js`
    // beside `Foo.web.js` and imports `./Foo` extensionless, leaving the choice
    // to the resolver — so the default extension order silently picks the
    // NATIVE file on web. That is how @hanzo/ui reaches react-native-svg's
    // fabric `*NativeComponent.js`, which imports react-native Flow source
    // webpack cannot parse ("Module parse failed: Unexpected token").
    webpackConfig.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...webpackConfig.resolve.extensions,
    ];

    return webpackConfig;
  },
};

export default config;
