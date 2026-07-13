import { describe, expect, it } from "bun:test"
import { formatToolInput, cleanText, extractTextFromParts } from "./agent-format"

describe("formatToolInput", () => {
  it("returns empty string for undefined input", () => {
    expect(formatToolInput("edit", undefined)).toBe("")
  })

  it("returns empty string for unknown tool", () => {
    expect(formatToolInput("unknown", { foo: "bar" })).toBe("")
  })

  describe("edit tool", () => {
    it("renders diff block with file path and old/new strings", () => {
      const result = formatToolInput("edit", {
        file_path: "/src/foo.ts",
        old_string: "const a = 1",
        new_string: "const a = 2",
      })
      expect(result).toContain("tool-diff")
      expect(result).toContain("/src/foo.ts")
      expect(result).toContain("const a = 1")
      expect(result).toContain("const a = 2")
      expect(result).toContain("tool-diff-old")
      expect(result).toContain("tool-diff-new")
    })

    it("escapes html in file path", () => {
      const result = formatToolInput("edit", {
        file_path: "/src/<script>.ts",
        old_string: "old",
        new_string: "new",
      })
      expect(result).toContain("&lt;script&gt;")
    })

    it("returns empty if both old and new are empty", () => {
      expect(formatToolInput("edit", { file_path: "/a.ts", old_string: "", new_string: "" })).toBe(
        "",
      )
    })
  })

  describe("bash tool", () => {
    it("renders command block", () => {
      const result = formatToolInput("bash", { command: "ls -la" })
      expect(result).toContain("tool-bash")
      expect(result).toContain("ls -la")
    })

    it("escapes html in command", () => {
      const result = formatToolInput("bash", { command: "echo <test>" })
      expect(result).toContain("&lt;test&gt;")
    })

    it("returns empty for empty command", () => {
      expect(formatToolInput("bash", { command: "" })).toBe("")
    })
  })

  describe("write tool", () => {
    it("renders file path and content preview", () => {
      const result = formatToolInput("write", {
        file_path: "/src/new.ts",
        content: "export const foo = 1",
      })
      expect(result).toContain("tool-write")
      expect(result).toContain("/src/new.ts")
      expect(result).toContain("export const foo = 1")
    })

    it("truncates long content to 500 chars", () => {
      const longContent = "x".repeat(600)
      const result = formatToolInput("write", { file_path: "/a.ts", content: longContent })
      expect(result).toContain("...")
      expect(result).not.toContain("x".repeat(600))
    })

    it("returns empty for empty file path", () => {
      expect(formatToolInput("write", { file_path: "", content: "data" })).toBe("")
    })
  })

  describe("view tool", () => {
    it("renders file path", () => {
      const result = formatToolInput("view", { file_path: "/src/foo.ts" })
      expect(result).toContain("tool-view")
      expect(result).toContain("/src/foo.ts")
    })

    it("renders offset and limit when provided", () => {
      const result = formatToolInput("view", { file_path: "/a.ts", offset: 10, limit: 50 })
      expect(result).toContain("10..50")
    })

    it("returns empty for empty file path", () => {
      expect(formatToolInput("view", { file_path: "" })).toBe("")
    })
  })

  describe("glob tool", () => {
    it("renders pattern", () => {
      const result = formatToolInput("glob", { pattern: "**/*.ts" })
      expect(result).toContain("tool-glob")
      expect(result).toContain("**/*.ts")
    })

    it("returns empty for empty pattern", () => {
      expect(formatToolInput("glob", { pattern: "" })).toBe("")
    })
  })

  describe("grep tool", () => {
    it("renders pattern", () => {
      const result = formatToolInput("grep", { pattern: "function\\s+\\w+" })
      expect(result).toContain("tool-grep")
      expect(result).toContain("function\\s+\\w+")
    })

    it("renders include filter when provided", () => {
      const result = formatToolInput("grep", { pattern: "foo", include: "*.ts" })
      expect(result).toContain("*.ts")
    })

    it("returns empty for empty pattern", () => {
      expect(formatToolInput("grep", { pattern: "" })).toBe("")
    })
  })
})

describe("cleanText", () => {
  it("removes system-reminder blocks", () => {
    const input = "Hello <system-reminder>internal stuff</system-reminder> world"
    expect(cleanText(input)).toBe("Hello  world")
  })

  it("trims whitespace", () => {
    expect(cleanText("  hello  ")).toBe("hello")
  })

  it("removes multi-line system-reminder", () => {
    const input = "before\n<system-reminder>\nline1\nline2\n</system-reminder>\nafter"
    expect(cleanText(input)).toBe("before\n\nafter")
  })
})

describe("extractTextFromParts", () => {
  it("extracts text parts", () => {
    const parts = [{ type: "text", text: "hello" }]
    expect(extractTextFromParts(parts, false)).toBe("hello")
  })

  it("skips reasoning when showReasoning is false", () => {
    const parts = [
      { type: "text", text: "answer" },
      { type: "reasoning", text: "thinking..." },
    ]
    expect(extractTextFromParts(parts, false)).toBe("answer")
  })

  it("includes reasoning when showReasoning is true", () => {
    const parts = [
      { type: "text", text: "answer" },
      { type: "reasoning", text: "thinking..." },
    ]
    const result = extractTextFromParts(parts, true)
    expect(result).toContain("answer")
    expect(result).toContain("thinking...")
    expect(result).toContain("reasoning-block")
  })

  it("renders completed tool with input", () => {
    const parts = [
      {
        type: "tool",
        tool: "edit",
        state: {
          status: "completed",
          title: "Edit",
          output: "Edit applied successfully.",
          input: {
            file_path: "/src/foo.ts",
            old_string: "old",
            new_string: "new",
          },
        },
      },
    ]
    const result = extractTextFromParts(parts, false)
    expect(result).toContain("**Edit**")
    expect(result).toContain("tool-diff")
    expect(result).toContain("Edit applied successfully.")
  })

  it("renders running tool", () => {
    const parts = [
      {
        type: "tool",
        tool: "bash",
        state: {
          status: "running",
          title: "Bash",
          input: { command: "npm test" },
        },
      },
    ]
    const result = extractTextFromParts(parts, false)
    expect(result).toContain("**Bash**")
    expect(result).toContain("tool-bash")
    expect(result).toContain("npm test")
  })

  it("renders pending tool", () => {
    const parts = [{ type: "tool", tool: "glob", state: { status: "pending" } }]
    expect(extractTextFromParts(parts, false)).toContain("*glob...*")
  })

  it("renders error tool", () => {
    const parts = [{ type: "tool", tool: "grep", state: { status: "error", error: "not found" } }]
    expect(extractTextFromParts(parts, false)).toContain("*grep: not found*")
  })

  it("renders agent part", () => {
    const parts = [{ type: "agent", name: "coder" }]
    expect(extractTextFromParts(parts, false)).toContain("*Agent: coder*")
  })

  it("skips unknown part types", () => {
    const parts = [{ type: "unknown" }]
    expect(extractTextFromParts(parts, false)).toBe("")
  })
})
