const TRANSITION_DISABLE_CSS =
  "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"

export function applyTheme(theme: "dark" | "light") {
  const el = document.documentElement
  // Disable transitions to prevent flash
  const style = document.createElement("style")
  style.appendChild(document.createTextNode(TRANSITION_DISABLE_CSS))
  document.head.appendChild(style)
  el.classList.remove("dark", "light")
  el.classList.add(theme)
  localStorage.setItem("vueuse-color-scheme", theme)
  // Force browser redraw, then remove the style
  void getComputedStyle(style).opacity
  document.head.removeChild(style)
}
