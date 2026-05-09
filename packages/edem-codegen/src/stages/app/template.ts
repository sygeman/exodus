// ── Vue Template Generation ───────────────────────────────────────────────────
// Renders IR component trees into Vue template strings.

import type { EventBinding } from "@exodus/edem-ui"
import type { IR, ExtendedComponentNode } from "../../ir"
import { capitalize, kebabCase, slugify, escapeAttr } from "../../utils"
import { resolveVueExpression, resolveInString, type ExpressionContext } from "../../expressions"
import { collectHandlerCode, buildExprCtx } from "./handlers"

export interface RenderResult {
  template: string
  handlers: Map<string, string>
}

export function renderNode(
  node: ExtendedComponentNode,
  indent: string,
  ir: IR,
  compName?: string,
): RenderResult {
  const handlers = new Map<string, string>()

  if (node.events) {
    collectHandlerCode(node.events, handlers, ir, compName)
  }

  // ── Conditional rendering ────────────────────────────────────────────────
  let ifAttr = ""
  if (node.if) {
    ifAttr = ` v-if="${extractExpr(node.if)}"`
  } else if (node.elseIf) {
    ifAttr = ` v-else-if="${extractExpr(node.elseIf)}"`
  } else if (node.else) {
    ifAttr = " v-else"
  }

  // ── Skeleton state ───────────────────────────────────────────────────────
  if (node.skeleton) {
    return {
      template: `${indent}<div${ifAttr} class="flex flex-1 flex-col gap-4">\n${indent}  <div class="mb-4 flex items-center justify-between">\n${indent}    <USkeleton class="h-8 w-40" />\n${indent}    <USkeleton class="h-9 w-32" />\n${indent}  </div>\n${indent}  <div v-for="i in 5" :key="i" class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4">\n${indent}    <USkeleton class="h-10 w-10 flex-shrink-0 rounded-lg" />\n${indent}    <USkeleton class="h-5 w-48" />\n${indent}  </div>\n${indent}</div>`,
      handlers,
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (node.empty) {
    const emptyIcon = node.empty.icon ?? "i-lucide-inbox"
    const emptyText = node.empty.text ?? "Nothing here yet"
    const emptyAction = node.empty.action
      ? `\n${indent}  ${renderNode(node.empty.action, indent + "  ", ir, compName).template}`
      : ""
    return {
      template: `${indent}<div${ifAttr} class="flex flex-1 flex-col items-center justify-center gap-4">\n${indent}  <UIcon name="${emptyIcon}" class="h-12 w-12 text-[var(--ui-text-muted)]" />\n${indent}  <p class="text-lg text-[var(--ui-text-muted)]">${emptyText}</p>${emptyAction}\n${indent}</div>`,
      handlers,
    }
  }

  const tag = node.component
  const exprCtx = buildExprCtx(ir, compName)
  const props = node.props ? renderProps(node.props, exprCtx) : ""
  const events = renderEvents(node.events)

  // ── Link (RouterLink) ────────────────────────────────────────────────────
  if (typeof node.link === "string") {
    // Don't wrap in RouterLink if bind.item is already a RouterLink
    const itemIsRouterLink =
      node.bind?.item &&
      typeof node.bind.item === "object" &&
      "component" in node.bind.item &&
      (node.bind.item as ExtendedComponentNode).component === "RouterLink"
    if (!itemIsRouterLink) {
      const to = resolveInString(node.link, exprCtx)
      const toAttr = to.includes("${") ? `:to="\`${to}\`"` : `:to="${to}"`
      const tagProps = props ? ` ${toAttr}${props}` : ` ${toAttr}`
      if (typeof node.children === "string") {
        return {
          template: `${indent}<RouterLink${tagProps}${ifAttr}${events}>${node.children}</RouterLink>`,
          handlers,
        }
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        const childResults = node.children.map((child) =>
          renderNode(child, indent + "  ", ir, compName),
        )
        for (const r of childResults) {
          for (const [k, v] of r.handlers) handlers.set(k, v)
        }
        const children = childResults.map((r) => r.template).join("\n")
        return {
          template: `${indent}<RouterLink${tagProps}${ifAttr}${events}>\n${children}\n${indent}</RouterLink>`,
          handlers,
        }
      }
      return {
        template: `${indent}<RouterLink${tagProps}${ifAttr}${events} />`,
        handlers,
      }
    }
  }

  // ── Modal wrapping ───────────────────────────────────────────────────────
  if (node.modal) {
    const vModel = node.modal.vModel
    const footerResult = node.modal.footer
      ? node.modal.footer.map((f) => renderNode(f, indent + "    ", ir, compName))
      : []
    for (const r of footerResult) {
      for (const [k, v] of r.handlers) handlers.set(k, v)
    }
    const footerHtml = footerResult.map((r) => r.template).join("\n")
    const title = node.modal.title ? ` title="${escapeAttr(node.modal.title)}"` : ""
    const desc = node.modal.description
      ? ` description="${escapeAttr(node.modal.description)}"`
      : ""
    return {
      template: `${indent}<UModal v-model:open="${vModel}"${title}${desc}>\n${indent}  <template #footer>\n${indent}    <div class="flex w-full justify-end gap-3">\n${footerHtml}\n${indent}    </div>\n${indent}  </template>\n${indent}</UModal>`,
      handlers,
    }
  }

  // ── Teleport ─────────────────────────────────────────────────────────────
  if (node.teleport) {
    const inner = renderNode(
      { ...node, teleport: undefined, component: "div" },
      indent + "  ",
      ir,
      compName,
    )
    for (const [k, v] of inner.handlers) handlers.set(k, v)
    return {
      template: `${indent}<Teleport to="${node.teleport}">\n${inner.template}\n${indent}</Teleport>`,
      handlers,
    }
  }

  // ── Transition wrapping ──────────────────────────────────────────────────
  if (node.transition) {
    const t = node.transition
    const attrs = [
      t.enterActiveClass ? ` enter-active-class="${escapeAttr(t.enterActiveClass)}"` : "",
      t.enterFromClass ? ` enter-from-class="${escapeAttr(t.enterFromClass)}"` : "",
      t.enterToClass ? ` enter-to-class="${escapeAttr(t.enterToClass)}"` : "",
      t.leaveActiveClass ? ` leave-active-class="${escapeAttr(t.leaveActiveClass)}"` : "",
      t.leaveFromClass ? ` leave-from-class="${escapeAttr(t.leaveFromClass)}"` : "",
      t.leaveToClass ? ` leave-to-class="${escapeAttr(t.leaveToClass)}"` : "",
    ].join("")
    const inner = renderNode({ ...node, transition: undefined }, indent + "  ", ir, compName)
    for (const [k, v] of inner.handlers) handlers.set(k, v)
    return {
      template: `${indent}<Transition${attrs}>\n${inner.template}\n${indent}</Transition>`,
      handlers,
    }
  }

  // ── Named slots ──────────────────────────────────────────────────────────
  if (node.namedSlots && tag !== "RouterView") {
    const isNativeElement = tag[0] === tag[0].toLowerCase()
    if (isNativeElement) {
      // Native HTML elements can't have named slots — render slot content as children
      const allSlotNodes = Object.values(node.namedSlots).flat()
      const childResults = allSlotNodes.map((n) => renderNode(n, indent + "  ", ir, compName))
      for (const r of childResults) {
        for (const [k, v] of r.handlers) handlers.set(k, v)
      }
      const children = childResults.map((r) => r.template).join("\n")
      return {
        template: `${indent}<${tag}${props}${ifAttr}${events}>\n${children}\n${indent}</${tag}>`,
        handlers,
      }
    }
    const slotEntries = Object.entries(node.namedSlots)
    const slotParts = slotEntries.map(([name, slotNodes]) => {
      const slotContent = slotNodes.map((n) => renderNode(n, indent + "    ", ir, compName))
      for (const r of slotContent) {
        for (const [k, v] of r.handlers) handlers.set(k, v)
      }
      return `${indent}  <template #${name}>\n${slotContent.map((r) => r.template).join("\n")}\n${indent}  </template>`
    })
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>\n${slotParts.join("\n")}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── bind.item = list iteration ───────────────────────────────────────────
  if (node.bind?.item) {
    const itemResult = renderNode(node.bind.item, indent + "  ", ir, compName)
    for (const [k, v] of itemResult.handlers) handlers.set(k, v)

    let vfor = ""
    if (node.bind.collection) {
      vfor = ` v-for="item in ${node.bind.collection}" :key="item.id"`
    } else if (node.bind.items) {
      const items = node.bind.items
      if (typeof items === "string" && items.includes("{{")) {
        const expr = items.replace(/\{\{\s*(.+?)\s*\}\}/g, "$1")
        vfor = ` v-for="(item, idx) in ${expr}" :key="idx"`
      } else if (Array.isArray(items)) {
        const hasObjects = items.some((v) => typeof v === "object" && v !== null)
        if (hasObjects) {
          const varName = `items_${compName ?? "static"}_${Math.random().toString(36).slice(2, 8)}`
          handlers.set(`const_${varName}`, `const ${varName} = ${JSON.stringify(items)} as const`)
          vfor = ` v-for="(item, idx) in ${varName}" :key="idx"`
        } else {
          const quoted = items.map((v) => (typeof v === "string" ? `'${v}'` : JSON.stringify(v)))
          vfor = ` v-for="(item, idx) in [${quoted.join(", ")}]" :key="idx"`
        }
      } else {
        vfor = ` v-for="(item, idx) in ${JSON.stringify(items)}" :key="idx"`
      }
    }

    return {
      template: `${indent}<${tag}${props}${vfor}${ifAttr}${events}>\n${itemResult.template}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── String children ──────────────────────────────────────────────────────
  if (typeof node.children === "string") {
    const content = resolveVueExpression(node.children, exprCtx)
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>${content}</${tag}>`,
      handlers,
    }
  }

  // ── Array children ───────────────────────────────────────────────────────
  if (Array.isArray(node.children) && node.children.length > 0) {
    const childResults = node.children.map((child) => {
      if (typeof child === "string") {
        const resolved = resolveVueExpression(child, exprCtx)
        return { template: `${indent}  ${resolved}`, handlers: new Map<string, string>() }
      }
      return renderNode(child, indent + "  ", ir, compName)
    })
    for (const r of childResults) {
      for (const [k, v] of r.handlers) handlers.set(k, v)
    }
    const children = childResults.map((r) => r.template).join("\n")
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>\n${children}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── Self-closing ─────────────────────────────────────────────────────────
  return {
    template: `${indent}<${tag}${props}${ifAttr}${events} />`,
    handlers,
  }
}

export function renderProps(props: Record<string, unknown>, ctx?: ExpressionContext): string {
  const entries = Object.entries(props)
  if (entries.length === 0) return ""

  return entries
    .map(([key, value]) => {
      const attr = kebabCase(key)

      if (key === "modelValue" || key === "model-value") {
        if (typeof value === "string" && value.startsWith("{{ ")) {
          return ` :model-value="${extractExpr(value)}"`
        }
        return ` :model-value="${JSON.stringify(value)}"`
      }

      if (typeof value === "string") {
        if (value.includes("{{ ")) {
          // Use context-aware resolution if available
          if (ctx) {
            const resolved = resolveVueExpression(value, ctx)
            // Single expression → :attr="expr"
            const singleMatch = value.match(/^\{\{\s*(.+?)\s*\}\}$/)
            if (singleMatch) {
              return ` :${attr}="${singleMatch[1]}"`
            }
            // Multi-expression → :attr="`resolved`"
            if (resolved !== value) {
              return ` :${attr}="\`${resolved.replace(/\{\{\s*/g, "${").replace(/\s*\}\}/g, "}")}\`"`
            }
          }
          const resolved = value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, e: string) => `\${${e}}`)
          if (
            resolved.startsWith("${") &&
            resolved.endsWith("}") &&
            !resolved.slice(2, -1).includes("${")
          ) {
            return ` :${attr}="${resolved.slice(2, -1)}"`
          }
          // If resolved contains ${}, wrap in backticks for template literal
          if (resolved.includes("${")) {
            return ` :${attr}="\`${resolved}\`"`
          }
          if (key === "style") {
            const parts = value
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
            const cssProps: string[] = []
            for (const part of parts) {
              const propMatch = part.match(/^([\w-]+):\s*\{\{\s*(.+?)\s*\}\}$/)
              if (propMatch) {
                const camelProp = propMatch[1].replace(/-([a-z])/g, (_: string, c: string) =>
                  c.toUpperCase(),
                )
                cssProps.push(`${camelProp}: ${propMatch[2]}`)
              }
            }
            if (cssProps.length > 0) {
              return ` :style="{ ${cssProps.join(", ")} }"`
            }
          }
          return ` :${attr}="${resolved}"`
        }
        // Wrap in quotes if contains template literal ${} to prevent syntax errors
        if (value.includes("${")) {
          return ` :${attr}="${value}"`
        }
        return ` ${attr}="${escapeAttr(value)}"`
      }
      if (typeof value === "boolean") {
        return value ? ` ${attr}` : ""
      }
      if (value === null || value === undefined) {
        return ""
      }
      if (Array.isArray(value)) {
        const items = value.map((v) => (typeof v === "string" ? `'${v}'` : JSON.stringify(v)))
        return ` :${attr}="[${items.join(", ")}]"`
      }
      return ` :${attr}="${JSON.stringify(value)}"`
    })
    .join("")
}

export function renderEvents(events: Record<string, EventBinding> | undefined): string {
  if (!events) return ""

  const parts: string[] = []
  for (const [eventName, binding] of Object.entries(events)) {
    if ("flow" in binding) {
      const hasEvent = binding.input && JSON.stringify(binding.input).includes("{{ event }}")
      const hasItem = binding.input && JSON.stringify(binding.input).includes("{{ item")
      const args: string[] = []
      if (hasEvent) args.push("$event")
      if (hasItem) args.push("item")
      const argStr = args.length > 0 ? `(${args.join(", ")})` : "()"
      parts.push(` @${kebabCase(eventName)}="handle${capitalize(binding.flow)}${argStr}"`)
    }
    if ("navigate" in binding) {
      parts.push(` @${kebabCase(eventName)}="handleNavigate${slugify(binding.navigate)}()"`)
    }
    if ("action" in binding) {
      if (eventName === "update:modelValue") {
        const col = binding.collection ?? "item"
        parts.push(` @update:model-value="handleUpdate${capitalize(col)}($event)"`)
      } else if (binding.action === "deleteItem" && binding.collection) {
        parts.push(` @${kebabCase(eventName)}="handleDelete${capitalize(binding.collection)}()"`)
      }
    }
  }

  return parts.join("")
}

export function extractExpr(template: string): string {
  if (!template.includes("{{")) return template
  const match = template.match(/\{\{\s*(.+?)\s*\}\}/)
  return match ? match[1] : template
}
