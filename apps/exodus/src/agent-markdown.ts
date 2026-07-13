import { marked } from "marked"

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(text: string): string {
  try {
    const html = marked.parse(text, { async: false }) as string
    return html.replace(/<p>\s*<\/p>/g, "").replace(/<p><\/p>/g, "")
  } catch {
    return text
  }
}

export function renderMarkdownSync(text: string): string {
  return renderMarkdown(text)
}
