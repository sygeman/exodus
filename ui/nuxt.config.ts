export default defineNuxtConfig({
	modules: ["@nuxt/ui"],
	css: ["~/assets/css/main.css"],
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	nitro: {
		preset: "bun",
		routeRules: {
			"/api/control/**": {
				proxy: `${process.env.CONTROL_API_URL || "http://localhost:8080"}/**`,
			},
		},
	},
	runtimeConfig: {
		public: {
			controlApiUrl: process.env.CONTROL_API_URL || "http://localhost:8080",
		},
	},
});
