import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const options: VueQueryPluginOptions = {
    queryClientConfig: {
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 минут
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    },
  }
  
  nuxtApp.vueApp.use(VueQueryPlugin, options)
})
