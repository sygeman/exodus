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



# [0.43.0](https://github.com/sygeman/exodus/compare/v0.42.0...v0.43.0) (2026-05-11)


### Bug Fixes

* **edem-codegen:** build vite before electrobun dev ([af7a650](https://github.com/sygeman/exodus/commit/af7a6506f3c138a6bf9ce5bd83af780d96db367f))
* **edem-codegen:** generate runnable electrobun app ([9171ccb](https://github.com/sygeman/exodus/commit/9171ccb59113087ae2c1cdc2507956acf7de2d29))
* **exodus:** update electrobun watch path to match new structure ([ebd12dc](https://github.com/sygeman/exodus/commit/ebd12dcb93e6eec727afd93e283e54d1c56273c6))
* **exodus:** use specific directories for electrobun watch ([84b3a7d](https://github.com/sygeman/exodus/commit/84b3a7df1644cc2cd962b5a607cc6a0efa2d87a8))


### Features

* add edem-codegen package, refactor edem-ui schemas and template engine ([d45c833](https://github.com/sygeman/exodus/commit/d45c8338bb8f6c8d4cdb50cf361de5656814fa24))
* add generated exodus app from codegen ([54a2ce7](https://github.com/sygeman/exodus/commit/54a2ce79e06859fdb1d8802fda45f710c9160943))
* **edem-codegen:** add assets manifest support (assets.json) ([66ecd7d](https://github.com/sygeman/exodus/commit/66ecd7deb4c3f11f8a924faadef44f02166f0fb5))
* **edem-codegen:** add Electrobun platform scripts to codegen ([9a43d48](https://github.com/sygeman/exodus/commit/9a43d48d28545fcf861d207c63da8e62280f4ce4))
* **edem-codegen:** add exodus-gen command, regenerate exodus app manifests ([660f3f0](https://github.com/sygeman/exodus/commit/660f3f0ecd108d345206cb3cd87b7564d0da9aab))
* **edem-codegen:** add platform.json manifest, layout components, and fix codegen bugs ([a8054b8](https://github.com/sygeman/exodus/commit/a8054b8d3e66085331333e78ade04558b5acfccf))
* **edem-codegen:** add splash screen as platform feature ([7e1d9f3](https://github.com/sygeman/exodus/commit/7e1d9f39f07db759f572b4df3b1bf20cf95a7b83))
* **edem-codegen:** auto-generate platform icons during codegen ([7a3b0af](https://github.com/sygeman/exodus/commit/7a3b0afafa8e4eb2ec8e1db791046ffaed2d361e))
* **edem-codegen:** split ui.json into routes + components/, extend codegen pipeline ([ebce68c](https://github.com/sygeman/exodus/commit/ebce68cbadc5636bee3f25377d06da4438170e62))
* **edem-flows:** add subflow resume and lifecycle await ([1d84fa3](https://github.com/sygeman/exodus/commit/1d84fa36285b087a035b71c9557fc6da06a7dd88))
* **edem-flows:** complete flow engine per spec ([3e4c304](https://github.com/sygeman/exodus/commit/3e4c30497ec69ffbce8dd0f27b3efdbec7eb7ad1))
* **edem-flows:** fix fork/join async, add loop auto-iteration, expand test coverage ([3e5ac1b](https://github.com/sygeman/exodus/commit/3e5ac1bdec86b5762c3663912870c247e6b04530)), closes [#3](https://github.com/sygeman/exodus/issues/3) [#11](https://github.com/sygeman/exodus/issues/11) [#15](https://github.com/sygeman/exodus/issues/15)
* **edem-flows:** implement 8 items from TODO ([9f0bbe3](https://github.com/sygeman/exodus/commit/9f0bbe30ec3c765e0abce37dc5bbdb1727c6feb9))
* **edem-flows:** implement core flow engine features from TODO ([5627ac7](https://github.com/sygeman/exodus/commit/5627ac713ab37c47c94a122e6c6bfcf34de4fda2))
* **edem-flows:** track last_run_at and catch up missed scheduled runs ([aa39eb3](https://github.com/sygeman/exodus/commit/aa39eb31f07bda1391d8e7cc7717829b0aff7325))
* **edem:** use explicit $type marker for i18n translations ([e2043ac](https://github.com/sygeman/exodus/commit/e2043acba36947bd67d593b7f5ecbbe1e1fb091d))
* extract logger dedup/query, add event bridge, flows-based state persistence ([d001c88](https://github.com/sygeman/exodus/commit/d001c8865e5438c28f50046556cef93e7ddbba7d))



