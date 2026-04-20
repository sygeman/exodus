# Edem UI Engine

## Overview

Presentation layer for the Edem platform. Displays data and handles user interaction.

Reference: **v0.dev**

## Concepts

### Primitives

| Primitive | Description |
|-----------|-------------|
| `Box` | Container, div equivalent |
| `Text` | Text display |
| `Image` | Image display |
| `Input` | Text input |
| `Button` | Clickable button |
| `Icon` | SVG icon |
| `Divider` | Visual separator |
| `Spacer` | Empty space |

### Layouts

| Layout | Description |
|--------|-------------|
| `Flex` | Flexbox layout |
| `Grid` | CSS Grid layout |
| `Stack` | Vertical/horizontal stack |
| `Absolute` | Absolute positioning |

### Components

Higher-level components composed from primitives: Card, List, Table, Form, Modal, Sidebar, Header.

## Data Binding

Connect UI to data layer.

### Static Binding
```typescript
{
  type: "text",
  props: { content: "{{ item.title }}" }
}
```

### Dynamic Binding
```typescript
{
  type: "list",
  data: { collection: "games", filter: { status: { _eq: "playing" } } },
  itemTemplate: { type: "card", props: { title: "{{ item.name }}" } }
}
```

### Event Binding
```typescript
{
  type: "button",
  props: {
    label: "Create",
    onClick: { flow: "create_game", input: { template: "default" } }
  }
}
```

## Events

### Commands

```typescript
ui:create_page → ui:page_created
ui:update_page → ui:page_updated
ui:delete_page → ui:page_deleted
ui:create_component → ui:component_created
ui:update_props → ui:props_updated
ui:bind_data → ui:data_bound
```

## Documentation

- [UI Layer](./docs/ui.md) — Full UI layer specification
