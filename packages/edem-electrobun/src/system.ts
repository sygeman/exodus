export function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return "en-US"
  }
}

export function getSystemTheme(): "dark" | "light" {
  if (process.platform === "darwin") {
    try {
      const { execSync } = require("child_process")
      const style = execSync("defaults read -g AppleInterfaceStyle", { encoding: "utf-8" }).trim()
      return style === "Dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process")
      const result = execSync(
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
        { encoding: "utf-8" },
      )
      return result.includes("0x0") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "linux") {
    try {
      const { execSync } = require("child_process")
      const theme = execSync("gsettings get org.gnome.desktop.interface gtk-theme", {
        encoding: "utf-8",
      }).trim()
      return theme.toLowerCase().includes("dark") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  return "light"
}
