# [1.4.0](https://github.com/sygeman/exodus/compare/v1.3.2...v1.4.0) (2026-05-14)


### Bug Fixes

* **flows:** add light theme support for glassmorphism node styles ([8f0020b](https://github.com/sygeman/exodus/commit/8f0020b90e30290324970870d8274f994de67982))
* **flows:** fix node/edge highlighting along path ([260575d](https://github.com/sygeman/exodus/commit/260575dbba4c11a49fbbcdba3d42195c7f9b46f5))
* **flows:** markRaw node/edge types, fix scheduler project_id validation, improve error logging ([b249860](https://github.com/sygeman/exodus/commit/b249860a73b223fdfc2d79185ffdd8d162b72cb7))
* **flows:** prevent deletion of trigger node in config panel ([0859178](https://github.com/sygeman/exodus/commit/08591784d4fb5cef71c9240e736e3f6ca70411c7))


### Features

* **flows:** glassmorphism styling for flow nodes ([71773c8](https://github.com/sygeman/exodus/commit/71773c81746db893763e63efd5f41d3ad74e8038))



## [1.3.2](https://github.com/sygeman/exodus/compare/v1.3.1...v1.3.2) (2026-05-14)


### Bug Fixes

* **flows:** preserve sourceHandle when creating node from connector drag ([da24eb9](https://github.com/sygeman/exodus/commit/da24eb9a96aedef85fdf16d07e21c1517d78ec34))



## [1.3.1](https://github.com/sygeman/exodus/compare/v1.3.0...v1.3.1) (2026-05-14)


### Bug Fixes

* **flows:** place new node at cursor position and make project_id optional for scheduler ([7d81953](https://github.com/sygeman/exodus/commit/7d81953684ecbca5e4a48c9d0da24b3048ab02f6))



# [1.3.0](https://github.com/sygeman/exodus/compare/v1.2.0...v1.3.0) (2026-05-13)


### Bug Fixes

* **flows:** add default border color to flow nodes ([9e6608f](https://github.com/sygeman/exodus/commit/9e6608fee520e7f726a52f658bd75ea5543b9fb0))
* **flows:** add default border color to flow nodes ([a95e5d2](https://github.com/sygeman/exodus/commit/a95e5d28c62292fa244a3a6e9bc75a1f24a84116))
* **flows:** add default border color to node handles ([9dca2e5](https://github.com/sygeman/exodus/commit/9dca2e5f8d94f11bb21e20f001a94e6abe8d06cb))
* **flows:** add selected state to handle border class ([9c40f57](https://github.com/sygeman/exodus/commit/9c40f57b10e1ac0c9fb133b8f366adf1685a9179))
* **flows:** remove overflow-hidden from node to fix border rendering on initial load ([854ef35](https://github.com/sygeman/exodus/commit/854ef351dc9407643394ecb9e94ecbfecbd04905))
* **flows:** set default handle border color via scoped CSS instead of utility classes ([697e66e](https://github.com/sygeman/exodus/commit/697e66ed7ffbf72b4bb30001740fcb5a4e9c43c1))
* **flows:** use non-important border-default on handles to preserve dynamic border highlights ([62a21ae](https://github.com/sygeman/exodus/commit/62a21ae66452555b5170cc10be2a12b2423befae))


### Features

* **flows:** add flow editor with vue-flow ([5113ba8](https://github.com/sygeman/exodus/commit/5113ba8b7ef7745411f2b1ef8ccf0ecf29b66ba1))
* **flows:** persist viewport and selected node in flow meta, refactor panel to use DB directly ([4a14758](https://github.com/sygeman/exodus/commit/4a1475866081770e4efaf5689a892a8271f88506))



# [1.2.0](https://github.com/sygeman/exodus/compare/v1.1.1...v1.2.0) (2026-05-12)


### Features

* **scheduler:** run scheduled flows immediately on startup ([d8f2299](https://github.com/sygeman/exodus/commit/d8f2299d15dfde4b5b6965abc29c89a81c83e39c))



