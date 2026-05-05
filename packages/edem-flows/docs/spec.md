# edem-flows Specification

## Goal

Full-featured flow execution engine. Declarative way to describe any business logic as a graph of nodes connected by edges. Reference: Unreal Blueprints.

## Entities

### Flow

```typescript
type Flow = {
  id: string
  name: string
  description?: string
  status: "draft" | "active" | "paused" | "archived"
  trigger_type: "manual" | "event" | "schedule" | "subflow"
  trigger_config?: Record<string, unknown>
  nodes: FlowNode[]
  edges: FlowEdge[]
  enabled: boolean
  system: boolean
  version: number
  created_at: number
  updated_at: number
}
```

### FlowNode

```typescript
type FlowNode = {
  id: string
  flow_id: string
  name?: string
  type: NodeType
  action?: string
  config?: Record<string, unknown>
  retry_max?: number
  retry_delay?: number
  timeout?: number
  position: { x: number; y: number }
}
```

### FlowEdge

```typescript
type FlowEdge = {
  id: string
  flow_id: string
  source_node_id: string
  source_port: string        // default: "output"
  target_node_id: string
  target_port: string        // default: "input"
  condition?: Record<string, unknown>
  label?: string
}
```

### FlowRun

```typescript
type FlowRun = {
  id: string
  flow_id: string
  status: FlowRunStatus
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  trigger_type: string
  trigger_data?: Record<string, unknown>
  context?: FlowContext
  checkpoint_node_id?: string
  checkpoint_context?: FlowContext
  parent_run_id?: string
  depth: number              // 0-10, for subflow nesting
  started_at?: number
  completed_at?: number
  created_at: number
}
```

### FlowRunNode

```typescript
type FlowRunNode = {
  id: string
  run_id: string
  node_id: string
  status: FlowRunNodeStatus
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  attempts: number
  started_at?: number
  completed_at?: number
  created_at: number
  updated_at: number
}
```

## Enums

### NodeType

| Node | Replaces in code |
|------|------------------|
| `trigger` | `on "event" → ...` |
| `action` | external service call / edem-data mutation |
| `condition` | `if (x === y) { ... } else { ... }` |
| `transform` | `const result = input * 2` |
| `loop` | `for (const item of items) { ... }` |
| `fork` | parallel execution branches |
| `join` | `Promise.all([...])` |
| `switch` | `switch(x) { case "a": ... }` |
| `delay` | `await sleep(5000)` |
| `input` | function arguments |
| `output` | function return value |
| `subflow` | call another function |

### FlowRunStatus

```
pending → running → completed | failed | cancelled | interrupted
                    ↑
         interrupted ─┘ (resume)
```

### FlowRunNodeStatus

```
pending → running → completed | failed | skipped | cancelled
           ↑
         pending (retry)
```

## Execution Engine

### Start

```
runFlow(flow_id, trigger_data?)
  → create FlowRun (status: pending)
  → find trigger nodes
  → for each trigger node: executeNode(node, context)
```

### executeNode(node, context)

```
1. checkBackpressure(run_id)
2. resolveInput(node, context)     // template resolution
3. create FlowRunNode (pending)
4. switch(node.type):
   - trigger:    pass through input
   - action:     emit tasks:create, wait for external completion
   - condition:  evaluate → follow true/false edge
   - transform:  apply operation (add, multiply, map, filter)
   - loop:       iterate with counter, emit tasks:create per iteration
   - fork:       branch to multiple edges
   - join:       wait for all/any/n_of_m branches
   - switch:     match value → follow matching case edge
   - delay:      sleep N seconds
   - input:      return trigger_data.inputs
   - output:     resolve templates, save to run.output
5. update FlowRunNode (completed)
6. for each next node (by edges): executeNode(next, context)
7. if all nodes completed: finalizeRun(completed)
```

## Context & Templates

### FlowContext

```typescript
type FlowContext = {
  trigger_data: Record<string, unknown>
  node_outputs: Record<string, Record<string, unknown>>
  flow_variables: Record<string, unknown>
}
```

### Template Resolution

Syntax: `{{scope.path.to.value}}`

| Scope | Example | Description |
|-------|---------|-------------|
| `trigger` | `{{trigger.inputs.name}}` | Trigger data |
| `nodes` | `{{nodes.node_id.output.field}}` | Node output |
| `context` | `{{context.my_var}}` | Flow variable |

### Example

```typescript
// Node config
{ "title": "{{trigger.inputs.name}} - {{nodes.abc.output.count}}" }

// Resolved
{ "title": "My Item - 42" }
```

## Node Implementations

### trigger
Pass-through. Sets `context.node_outputs[node_id] = input`.

### action
Emits `tasks:create` event with `{ type, input, flowRunId, flowNodeId }`. Waits for external `handleNodeCompleted(run_id, node_id, output)`.

### condition
```typescript
config: {
  field: string,
  value: unknown,
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains"
}
```
Returns `{ result: boolean }`. Follows edges with `condition: "true"` or `condition: "false"`.

### transform
```typescript
config: {
  field: string,
  operation: "add" | "multiply" | "set" | "append",
  value: unknown
}
```
Returns `{ result: unknown }`.

### loop
```typescript
config: { maxIterations: number }
```
Tracks `context.flow_variables["nodes.{id}.currentIteration"]`. Emits `tasks:create` per iteration. Increments counter.

### fork
```typescript
config: { branches: Array<{ id: string }> }
```
Creates FlowRunNode for each branch target. Stores results in `context.flow_variables["nodes.{id}.forkResults"]`.

### join
```typescript
config: {
  mode: "all" | "any" | "n_of_m",
  n?: number,
  onError: "fail" | "continue" | "skip"
}
```
Checks all branch FlowRunNodes. Aggregates outputs.

### switch
```typescript
config: {
  value: string,
  cases: Array<{ value: string, handle: string }>,
  default_handle?: string
}
```
Resolves `value` template, matches against cases, follows matching edge by `label`.

### delay
```typescript
config: { seconds: number }
```
Sleeps, returns `{ status: "completed", delayed_seconds }`.

### input
Returns `context.trigger_data.inputs`.

### output
```typescript
config: { outputs: Record<string, string> }  // values are template paths
```
Resolves templates, saves to `FlowRun.output`.

### subflow
```typescript
config: { flow_id: string }
```
Creates nested FlowRun with `parent_run_id` and `depth + 1`. Max depth: 10.

## Persistence (edem-data)

| Collection | Fields |
|------------|--------|
| `flows` | name, description, status, trigger_type, trigger_config, enabled, system, version |
| `flow_runs` | flow_id, status, input, output, error, trigger_type, trigger_data, context, checkpoint_node_id, checkpoint_context, parent_run_id, depth |
| `flow_run_nodes` | run_id, node_id, status, input, output, error, attempts |

## API

### Mutations

| Name | Input | Output |
|------|-------|--------|
| createFlow | { name, trigger_type, nodes?, edges? } | { flow_id } |
| updateFlow | { flow_id, name?, status?, nodes?, edges?, enabled? } | { success } |
| deleteFlow | { flow_id } | { success } |
| runFlow | { flow_id, trigger_data? } | { run_id, status } |
| cancelRun | { run_id } | { success } |
| resumeRun | { run_id } | { success } |
| handleNodeCompleted | { run_id, node_id, output } | { success } |
| handleNodeFailed | { run_id, node_id, error } | { success } |

### Queries

| Name | Input | Output |
|------|-------|--------|
| getFlow | { flow_id } | { flow } |
| listFlows | { status? } | { flows } |
| getRun | { run_id } | { run } |
| listRuns | { flow_id, status? } | { runs } |
| getRunNodes | { run_id } | { nodes } |

### Subscriptions

| Name | Output |
|------|--------|
| flowCreated | Flow |
| flowUpdated | Flow |
| flowDeleted | { flow_id } |
| runStarted | FlowRun |
| runUpdated | FlowRun |
| runCompleted | FlowRun |
| nodeStarted | { run_id, node_id } |
| nodeCompleted | { run_id, node_id, output } |

## Events (for external integration)

```typescript
// Emitted by flows module
"flows:run_started"    → { run_id, flow_id, trigger_data }
"flows:node_started"   → { run_id, node_id, input }
"flows:node_completed" → { run_id, node_id, output }
"flows:run_completed"  → { run_id, flow_id, output }
"flows:run_failed"     → { run_id, flow_id, error }
"flows:run_cancelled"  → { run_id, flow_id }

// Listened by flows module
"tasks:completed"      → { flowRunId, flowNodeId, output }
"tasks:failed"         → { flowRunId, flowNodeId, error }
```

## Implementation Phases

### Phase 1: Schema & Persistence ✅ Done
- Flow CRUD via edem-data
- Collection auto-creation

### Phase 2: Execution Engine
- FlowContext with template resolution
- Node executors (trigger, condition, transform, switch, delay, input, output)
- Edge traversal with condition support
- FlowRunNode tracking

### Phase 3: Async Nodes
- action node → tasks:create event
- handleNodeCompleted / handleNodeFailed
- loop node with iteration tracking

### Phase 4: Fork/Join
- fork node → parallel branches
- join node → wait for all/any/n_of_m

### Phase 5: Advanced
- subflow (nested runs)
- checkpoint/resume
- retry with exponential backoff
- backpressure (pending/concurrent limits)
- state machine validation
