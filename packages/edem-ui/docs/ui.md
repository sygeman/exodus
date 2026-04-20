# UI Layer

## Overview

Presentation layer. Displays data and handles user interaction.

Reference: **v0.dev**

## Concepts

### Primitives

Basic building blocks. Every UI element is a primitive or composition of primitives.

| Primitive | Description | Props |
|-----------|-------------|-------|
| `Box` | Container, div equivalent | width, height, padding, margin, background, border, radius |
| `Text` | Text display | content, size, weight, color, align |
| `Image` | Image display | src, alt, fit, radius |
| `Input` | Text input | value, placeholder, type, disabled |
| `Button` | Clickable button | label, variant, disabled, icon |
| `Icon` | SVG icon | name, size, color |
| `Divider` | Visual separator | orientation, thickness |
| `Spacer` | Empty space | size |

### Layouts

Ways to arrange primitives.

| Layout | Description | Props |
|--------|-------------|-------|
| `Flex` | Flexbox layout | direction, justify, align, gap, wrap |
| `Grid` | CSS Grid layout | columns, rows, gap, template |
| `Stack` | Vertical/horizontal stack | spacing, divider, align |
| `Absolute` | Absolute positioning | top, left, right, bottom, zIndex |

### Components

Higher-level components composed from primitives.

| Component | Primitives Used |
|-----------|----------------|
| `Card` | Box + Text + optional Image |
| `List` | Stack + repeated items |
| `Table` | Grid + Text + Box |
| `Form` | Stack + Input + Button |
| `Modal` | Absolute + Box + Stack |
| `Sidebar` | Box + Stack + Button |
| `Header` | Box + Flex + Text + Button |

## Data Binding

Connect UI to data layer.

### Static Binding

```typescript
// Bind text to field value
{
  type: "text",
  props: {
    content: "{{ item.title }}"
  }
}
```

### Dynamic Binding

```typescript
// Bind to collection query
{
  type: "list",
  data: {
    collection: "games",
    filter: { status: { _eq: "playing" } },
    sort: ["-created_at"]
  },
  itemTemplate: {
    type: "card",
    props: {
      title: "{{ item.name }}",
      image: "{{ item.cover }}"
    }
  }
}
```

### Event Binding

```typescript
// Bind click to flow trigger
{
  type: "button",
  props: {
    label: "Create",
    onClick: {
      flow: "create_game",
      input: { template: "default" }
    }
  }
}
```

## Page Structure

```typescript
type Page = {
  id: string
  name: string
  route: string          // URL path, e.g., "/games"
  layout: LayoutConfig
  components: Component[]
  bindings: DataBinding[]
}

type Component = {
  id: string
  type: string           // primitive or component name
  props: object
  children?: Component[]
  bindings?: DataBinding[]
  events?: EventBinding[]
}

type DataBinding = {
  target: string         // prop path, e.g., "props.content"
  source: {
    type: "collection" | "item" | "field" | "static"
    collection?: string
    item?: string
    field?: string
    value?: unknown
  }
}

type EventBinding = {
  trigger: string        // "onClick", "onChange", "onSubmit"
  action: {
    type: "flow" | "navigate" | "emit"
    target: string
    input?: object
  }
}
```

## Events

### Commands

```typescript
// Create page
ui:create_page → ui:page_created

// Update page
ui:update_page → ui:page_updated

// Delete page
ui:delete_page → ui:page_deleted

// Create component
ui:create_component → ui:component_created

// Update component props
ui:update_props → ui:props_updated

// Bind data
ui:bind_data → ui:data_bound
```

### Event Schemas

```typescript
// ui:create_page
{
  name: string,
  route: string,
  layout: LayoutConfig,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// ui:page_created
{
  page_id: string,
  name: string,
  route: string,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## Generation via MCP

AI agent can generate UI through MCP:

```typescript
// Agent requests UI generation
mcp:call_tool → {
  name: "ui_generate_page",
  args: {
    description: "A page showing all games with cover images",
    collection: "games",
    layout: "grid"
  }
}

// Result: page created with components and bindings
```

## Styling

### Theme

```typescript
type Theme = {
  colors: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
    textMuted: string
    border: string
    success: string
    warning: string
    error: string
  }
  spacing: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
  typography: {
    fontFamily: string
    sizes: {
      xs: number
      sm: number
      md: number
      lg: number
      xl: number
    }
  }
  radii: {
    sm: number
    md: number
    lg: number
  }
}
```

### Component Variants

```typescript
// Button variants
{
  "button": {
    "variants": {
      "solid": { background: "primary", color: "white" },
      "outline": { border: "1px solid primary", color: "primary" },
      "ghost": { color: "primary" }
    },
    "sizes": {
      "sm": { padding: "4px 8px", fontSize: "sm" },
      "md": { padding: "8px 16px", fontSize: "md" },
      "lg": { padding: "12px 24px", fontSize: "lg" }
    }
  }
}
```
