# [2.1.0](https://github.com/sygeman/exodus/compare/v2.0.0...v2.1.0) (2026-06-01)


### Bug Fixes

* **projects:** show logos in project navigation ([044f626](https://github.com/sygeman/exodus/commit/044f626ce1bcf995c3fc65fa2f2bd95b877ed34f))
* resolve @nuxt/ui icon compatibility and Vue 3.5.35 defineProps type issue ([5d44774](https://github.com/sygeman/exodus/commit/5d44774fd57bd9120e9e111be84774fca538f3dd))
* **ui:** allow root node to be highlighted in preview ([a959547](https://github.com/sygeman/exodus/commit/a959547facc5702c1188d5c55afcb091a34aaa76))
* **ui:** control expanded state on UTree so toggle works when node is selected ([e58490e](https://github.com/sygeman/exodus/commit/e58490e14a84ab6c2f44efdb34f41d3f5b24d564))
* **ui:** expand ancestor nodes when selecting from preview ([55f501b](https://github.com/sygeman/exodus/commit/55f501b0a12c6098f7b3583b14907115f961ca8a))
* **ui:** handle component render errors in preview node ([b61f259](https://github.com/sygeman/exodus/commit/b61f2599dff8c2d400e7a477a4583b5afef67164))
* **ui:** let UTree handle both select and expand natively via v-model ([76c739a](https://github.com/sygeman/exodus/commit/76c739aceebbde09c7f99987e36c12d5f571216f))
* **ui:** let UTree handle expand/collapse without interference ([1c32927](https://github.com/sygeman/exodus/commit/1c32927cfe05e146d7581074001d1c4322e3bc55))
* **ui:** normalize sizes in add component modal ([0350a57](https://github.com/sygeman/exodus/commit/0350a574830d0251375e79fc3d346f9ee3cc9dda))
* **ui:** remove inspector header and add top padding to content ([4dff448](https://github.com/sygeman/exodus/commit/4dff448201fd2435c3d1107b6c91583b5b2c25db))
* **ui:** remove layers panel header ([f865b69](https://github.com/sygeman/exodus/commit/f865b69c5b86b98a0c3521792fc10b4fa6e601c3))
* **ui:** remove props count badge from inspector ([23d691c](https://github.com/sygeman/exodus/commit/23d691c91d74775880f3517b60f281c1c966aa53))
* **ui:** restrict tree toggle to chevron clicks only ([c19e970](https://github.com/sygeman/exodus/commit/c19e970f648dfc140a97fe9b0004e9efd2ed41c9))
* **ui:** separate select and toggle in UTree layers panel ([aaa683b](https://github.com/sygeman/exodus/commit/aaa683b6348379b775b534f54361822ccbd58b76))
* **ui:** show root node in layers tree ([942daf9](https://github.com/sygeman/exodus/commit/942daf9a2383c8098f9eec912e9959c7f94a2108))
* **ui:** stretch toolbar to full width of inspector panel ([1012fcf](https://github.com/sygeman/exodus/commit/1012fcf98ccbc004f776fb9e70912caef68ff6a5))
* **ui:** sync layer tree selection with preview highlight ([c167a90](https://github.com/sygeman/exodus/commit/c167a908069c55537368503cd74f2302e90c6f57))
* **ui:** use error boundary wrapper for dynamic component preview ([c79664e](https://github.com/sygeman/exodus/commit/c79664e0e118d02976dcd5a5d085b37935c48583))


### Features

* **data:** add chunked file transport ([8f3a251](https://github.com/sygeman/exodus/commit/8f3a251cc4154b23062d71df7e4a80631a4578ce))
* **data:** add generated system fields to schema editor ([5691c9f](https://github.com/sygeman/exodus/commit/5691c9fd1b872f5c30f466c992d4febda2ab7179))
* **data:** add schema field templates and relation cardinality ([86de0f4](https://github.com/sygeman/exodus/commit/86de0f4a84f9b865d76e40186eb829c4d0bbf982))
* **data:** move manifest to project panel ([5ff31ea](https://github.com/sygeman/exodus/commit/5ff31eac60967556994fd637de83b39f90285d59))
* **exodus:** add project manifest authoring for data and ui ([f266101](https://github.com/sygeman/exodus/commit/f26610170456443bba88e456519b0d93a8bea7fa))
* **flows:** add map nodes for payload and filter mapping ([1b92956](https://github.com/sygeman/exodus/commit/1b929568393fa6aa810109823e3ddcbb047734b3))
* **flows:** canonicalize flow authoring and runtime shape ([de0378f](https://github.com/sygeman/exodus/commit/de0378fdb27d03ff441befaeccf1e1cede879e05))
* **flows:** surface node contracts in the editor ([f1d6835](https://github.com/sygeman/exodus/commit/f1d68350a6da9833dbc649f14736b790a1107c55))
* **flows:** use project data schemas in map contracts ([7110e4b](https://github.com/sygeman/exodus/commit/7110e4b56f5173388d2adc831a3501dd86384280))
* **projects:** add project logo upload ([b72ff82](https://github.com/sygeman/exodus/commit/b72ff826b69a697dc964c326161a01e69dea715e))
* **ui:** add component preview back to add component modal ([bff4dae](https://github.com/sygeman/exodus/commit/bff4daed11a1078ed932a327f4e973a537682a40))
* **ui:** add project UI component browser ([c17bc92](https://github.com/sygeman/exodus/commit/c17bc924d14c49a24f1d3d7b27bc9e2a0f68b01a))



# [2.0.0](https://github.com/sygeman/exodus/compare/v1.15.0...v2.0.0) (2026-05-19)


### Bug Fixes

* **flows:** scope Exodus runtime to system flows ([82728de](https://github.com/sygeman/exodus/commit/82728de3cd135c68be5a89473ee9f9fe5b215c57))


* refactor(flows)!: remove webhook trigger support ([bf5bcb8](https://github.com/sygeman/exodus/commit/bf5bcb89db361ee9f33041ce82e7bee4fd96d47f))


### BREAKING CHANGES

* webhook triggers are no longer accepted in flow definitions or exposed by the dispatcher API.



# [1.15.0](https://github.com/sygeman/exodus/compare/v1.14.1...v1.15.0) (2026-05-19)


### Features

* **flows:** add flow and subflow graph contracts ([db42e05](https://github.com/sygeman/exodus/commit/db42e05fef7a7bb7fd1df012e028808a5c0ab450))



## [1.14.1](https://github.com/sygeman/exodus/compare/v1.14.0...v1.14.1) (2026-05-19)


### Bug Fixes

* **edem-vue:** evaluate templated runtime conditions ([162e7f0](https://github.com/sygeman/exodus/commit/162e7f0a33300a50b488cfa633a7c5f7808ac135))



# [1.14.0](https://github.com/sygeman/exodus/compare/v1.13.0...v1.14.0) (2026-05-19)


### Bug Fixes

* **edem-codegen:** close IdeaPage parity slice ([9f5b1e6](https://github.com/sygeman/exodus/commit/9f5b1e616be035b8c23047201dcd1988094f553b))
* **edem-codegen:** improve manifest page parity generation ([2d6da9c](https://github.com/sygeman/exodus/commit/2d6da9cac73db2136cafe13e813d93081b9d1903))
* **edem-codegen:** reduce flow page parity gaps ([3f341c5](https://github.com/sygeman/exodus/commit/3f341c560a910b5d3e4ee114502da76e36508387))
* **edem-codegen:** reduce parity noise for manifest pages ([134d242](https://github.com/sygeman/exodus/commit/134d24236ebc5bab0595891811ac43ea0449a169))
* **edem-codegen:** reduce project page parity gaps ([2005509](https://github.com/sygeman/exodus/commit/2005509cfce81e6eb57d17a651d5444194d5eb78))
* **edem-codegen:** sync shared runtime files into generated app ([6925279](https://github.com/sygeman/exodus/commit/6925279f06e7bedab372527c2131e347474ec8a5))


### Features

* **edem-codegen:** add page wrappers and manifest action helpers ([2c47cf0](https://github.com/sygeman/exodus/commit/2c47cf0bfd2c69a93f6b38533e8f2c90cf689669))



