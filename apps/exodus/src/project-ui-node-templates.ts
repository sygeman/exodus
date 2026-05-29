import type { ComponentNode } from "@/project-manifest-schemas"

export type UiNodeTemplateOption = {
  component: string
  label: string
  icon?: string
  group: "html" | "ui" | "layout" | "form" | "data" | "feedback"
}

export const UI_NODE_TEMPLATE_OPTIONS: UiNodeTemplateOption[] = [
  { component: "div", label: "div", icon: "i-lucide-square", group: "html" },
  { component: "section", label: "section", icon: "i-lucide-square-dashed", group: "html" },
  { component: "span", label: "span", icon: "i-lucide-minus", group: "html" },
  { component: "p", label: "p", icon: "i-lucide-align-left", group: "html" },
  { component: "h1", label: "h1", icon: "i-lucide-heading-1", group: "html" },
  { component: "h2", label: "h2", icon: "i-lucide-heading-2", group: "html" },
  { component: "h3", label: "h3", icon: "i-lucide-heading-3", group: "html" },
  { component: "button", label: "button", icon: "i-lucide-square-mouse-pointer", group: "html" },
  { component: "img", label: "img", icon: "i-lucide-image", group: "html" },
  { component: "a", label: "a", icon: "i-lucide-external-link", group: "html" },
  { component: "ul", label: "ul", icon: "i-lucide-list", group: "html" },
  { component: "li", label: "li", icon: "i-lucide-list-ordered", group: "html" },

  { component: "UButton", label: "UButton", group: "ui" },
  { component: "UIcon", label: "UIcon", group: "ui" },
  { component: "UBadge", label: "UBadge", group: "ui" },
  { component: "UAvatar", label: "UAvatar", group: "ui" },
  { component: "UTooltip", label: "UTooltip", group: "ui" },
  { component: "UChip", label: "UChip", group: "ui" },
  { component: "UKbd", label: "UKbd", group: "ui" },
  { component: "USeparator", label: "USeparator", group: "ui" },
  { component: "UProgress", label: "UProgress", group: "ui" },
  { component: "ULink", label: "ULink", group: "ui" },
  { component: "RouterLink", label: "RouterLink", icon: "i-lucide-link", group: "ui" },

  { component: "UInput", label: "UInput", group: "form" },
  { component: "UTextarea", label: "UTextarea", group: "form" },
  { component: "USelect", label: "USelect", group: "form" },
  { component: "USwitch", label: "USwitch", group: "form" },
  { component: "UCheckbox", label: "UCheckbox", group: "form" },
  { component: "URadioGroup", label: "URadioGroup", group: "form" },
  { component: "UInputNumber", label: "UInputNumber", group: "form" },
  { component: "UFormField", label: "UFormField", group: "form" },
  { component: "UForm", label: "UForm", group: "form" },

  { component: "UCard", label: "UCard", group: "layout" },
  { component: "UModal", label: "UModal", group: "layout" },
  { component: "UDrawer", label: "UDrawer", group: "layout" },
  { component: "UTabs", label: "UTabs", group: "layout" },
  { component: "UAccordion", label: "UAccordion", group: "layout" },
  { component: "UCollapsible", label: "UCollapsible", group: "layout" },
  { component: "UBreadcrumb", label: "UBreadcrumb", group: "layout" },
  { component: "UPage", label: "UPage", group: "layout" },
  { component: "UPageHeader", label: "UPageHeader", group: "layout" },
  { component: "UPageBody", label: "UPageBody", group: "layout" },
  { component: "UContainer", label: "UContainer", group: "layout" },
  { component: "UHeader", label: "UHeader", group: "layout" },
  { component: "UFooter", label: "UFooter", group: "layout" },
  { component: "USidebar", label: "USidebar", group: "layout" },

  { component: "UTable", label: "UTable", group: "data" },
  { component: "UPagination", label: "UPagination", group: "data" },
  { component: "UAlert", label: "UAlert", group: "feedback" },
  { component: "UEmpty", label: "UEmpty", group: "feedback" },
  { component: "USkeleton", label: "USkeleton", group: "feedback" },
]

export function createDefaultUiNode(component: string): ComponentNode {
  switch (component) {
    // HTML
    case "p":
      return { component, children: "Text" }
    case "span":
      return { component, children: "Text" }
    case "h1":
      return { component, children: "Heading" }
    case "h2":
      return { component, children: "Heading" }
    case "h3":
      return { component, children: "Heading" }
    case "button":
      return { component, children: "Button" }
    case "img":
      return {
        component,
        props: { src: "https://placehold.co/640x360", alt: "Image" },
      }
    case "a":
      return { component, props: { href: "#" }, children: "Link" }
    case "ul":
      return { component, children: [] }
    case "li":
      return { component, children: "Item" }

    // UI
    case "UButton":
      return { component, props: { color: "primary" }, children: "Action" }
    case "UIcon":
      return { component, props: { name: "i-lucide-star" } }
    case "UBadge":
      return { component, props: { label: "Badge" } }
    case "UAvatar":
      return { component, props: { alt: "Avatar", src: "https://placehold.co/80x80" } }
    case "UTooltip":
      return { component, props: { text: "Tooltip text" }, children: [] }
    case "UChip":
      return { component, children: [] }
    case "UKbd":
      return { component, props: { value: "K" } }
    case "USeparator":
      return { component }
    case "UProgress":
      return { component, props: { value: 50 } }
    case "ULink":
      return { component, props: { to: "/" }, children: "Link" }
    case "RouterLink":
      return { component, props: { to: "/" }, children: "Link" }

    // Form
    case "UInput":
      return { component, props: { placeholder: "Type here" } }
    case "UTextarea":
      return { component, props: { placeholder: "Write here", rows: 4 } }
    case "USelect":
      return {
        component,
        props: {
          placeholder: "Select...",
          items: ["Option 1", "Option 2", "Option 3"],
        },
      }
    case "USwitch":
      return { component }
    case "UCheckbox":
      return { component, props: { label: "Checkbox" } }
    case "URadioGroup":
      return {
        component,
        props: {
          items: ["Option 1", "Option 2"],
        },
      }
    case "UInputNumber":
      return { component, props: { placeholder: "0" } }
    case "UFormField":
      return {
        component,
        props: { label: "Field label", description: "Field description" },
        children: [],
      }
    case "UForm":
      return { component, children: [] }

    // Layout
    case "UCard":
      return {
        component,
        children: [],
      }
    case "UModal":
      return { component, children: [] }
    case "UDrawer":
      return { component, children: [] }
    case "UTabs":
      return {
        component,
        props: {
          items: [
            { label: "Tab 1", content: "Content 1" },
            { label: "Tab 2", content: "Content 2" },
          ],
        },
      }
    case "UAccordion":
      return {
        component,
        props: {
          items: [
            { label: "Section 1", content: "Content 1" },
            { label: "Section 2", content: "Content 2" },
          ],
        },
      }
    case "UCollapsible":
      return {
        component,
        props: { label: "Collapsible" },
        children: [],
      }
    case "UBreadcrumb":
      return {
        component,
        props: {
          items: [
            { label: "Home", to: "/" },
            { label: "Page", to: "/page" },
          ],
        },
      }
    case "UPage":
      return { component, children: [] }
    case "UPageHeader":
      return {
        component,
        props: { title: "Page Title", description: "Page description" },
      }
    case "UPageBody":
      return { component, children: [] }
    case "UContainer":
      return { component, children: [] }
    case "UHeader":
      return { component, children: [] }
    case "UFooter":
      return { component, children: [] }
    case "USidebar":
      return { component, children: [] }

    // Data
    case "UTable":
      return { component }
    case "UPagination":
      return { component, props: { total: 100 } }

    // Feedback
    case "UAlert":
      return {
        component,
        props: {
          title: "Alert title",
          description: "Alert description",
          color: "info",
        },
      }
    case "UEmpty":
      return {
        component,
        props: {
          icon: "i-lucide-inbox",
          title: "No data",
          description: "There is nothing here yet.",
        },
      }
    case "USkeleton":
      return { component, props: { class: "h-4 w-full" } }

    default:
      return { component, children: [] }
  }
}
