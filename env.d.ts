declare const __APP_VERSION__: string

declare module "*.css" {}
declare module "*.svg" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent
  export default component
}
declare module "three" {}
