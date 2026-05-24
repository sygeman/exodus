import type { ComponentNode } from "@/project-manifest-schemas"

export type UiNodeTemplateOption = {
  component: string
  label: string
}

export const UI_NODE_TEMPLATE_OPTIONS: UiNodeTemplateOption[] = [
  { component: "div", label: "div" },
  { component: "section", label: "section" },
  { component: "span", label: "span" },
  { component: "p", label: "p" },
  { component: "h1", label: "h1" },
  { component: "button", label: "button" },
  { component: "img", label: "img" },
  { component: "UButton", label: "UButton" },
  { component: "UInput", label: "UInput" },
  { component: "UTextarea", label: "UTextarea" },
  { component: "RouterLink", label: "RouterLink" },
  { component: "UIcon", label: "UIcon" },
]

export function createDefaultUiNode(component: string): ComponentNode {
  switch (component) {
    case "p":
      return { component, children: "Text" }
    case "h1":
      return { component, children: "Heading" }
    case "button":
      return { component, children: "Button" }
    case "img":
      return {
        component,
        props: {
          src: "https://placehold.co/640x360",
          alt: "Image",
        },
      }
    case "UButton":
      return {
        component,
        props: {
          color: "primary",
        },
        children: "Action",
      }
    case "UInput":
      return {
        component,
        props: {
          placeholder: "Type here",
        },
      }
    case "UTextarea":
      return {
        component,
        props: {
          placeholder: "Write here",
          rows: 4,
        },
      }
    case "RouterLink":
      return {
        component,
        props: {
          to: "/",
        },
        children: "Link",
      }
    case "UIcon":
      return {
        component,
        props: {
          name: "i-lucide-star",
        },
      }
    case "span":
      return { component, children: "Text" }
    default:
      return {
        component,
        children: [],
      }
  }
}
