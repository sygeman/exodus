# [1.2.0](https://github.com/sygeman/exodus/compare/v1.1.1...v1.2.0) (2026-05-12)


### Features

* **scheduler:** run scheduled flows immediately on startup ([d8f2299](https://github.com/sygeman/exodus/commit/d8f2299d15dfde4b5b6965abc29c89a81c83e39c))



## [1.1.1](https://github.com/sygeman/exodus/compare/v1.1.0...v1.1.1) (2026-05-12)


### Bug Fixes

* **ci:** enable git pull before push in release workflow ([fffb943](https://github.com/sygeman/exodus/commit/fffb943f55d7dad7d60167e7d87a25c032d055dc))



# [1.1.0](https://github.com/sygeman/exodus/compare/v1.0.0...v1.1.0) (2026-05-12)


### Features

* **data:** move locales from hardcoded to app_state singleton ([e9e9e1d](https://github.com/sygeman/exodus/commit/e9e9e1d900530951db6b14d7b8d99f86000894d5))
* **edem-vue:** add Vue renderer for JSON component trees ([dba48c7](https://github.com/sygeman/exodus/commit/dba48c7bf87888d9950a70a4b4fedc582963000e))



# [1.0.0](https://github.com/sygeman/exodus/compare/v0.44.0...v1.0.0) (2026-05-11)


### Code Refactoring

* **edem-electrobun:** move logger to shared package with callback-based writes ([c3a4377](https://github.com/sygeman/exodus/commit/c3a4377b4f99f9298a31efa8f94412b11c9e7c9f))


### Features

* **edem-data:** add singleton API with getSingleton, updateSingleton, and useSingleton hook ([5b0a039](https://github.com/sygeman/exodus/commit/5b0a039c47c01cae0ad560ecdd4c87e5a6795da8))


### BREAKING CHANGES

* **edem-electrobun:** logger APIs now require a write callback instead of accepting edem data module directly



# [0.44.0](https://github.com/sygeman/exodus/compare/v0.43.0...v0.44.0) (2026-05-11)


### Features

* **edem-electrobun:** proper edem-core patterns with subscription, query, and emit ([1bf9904](https://github.com/sygeman/exodus/commit/1bf9904567d82757ecb402081f2bf87317db2dcc))
* **edem-vue:** add Vue hooks for electrobun and flows modules ([f2c214f](https://github.com/sygeman/exodus/commit/f2c214f91ef5c254fc34355997abd22c87893fef))



