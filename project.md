```mermaid
flowchart LR
  %% Clients
  web["Web UI\nRuns / Tasks / Approvals"]
  planner["Planner \(MCP client\)\nChatGPT / Claude"]

  %% Orchestrator core
  subgraph core["Orchestrator"]
    api["API / MCP Server\nTask intake, Runs, SSE"]
    workers["Workers\n• Composer\n• Approvals\n• Webhooks\n• MCP Adapters"]
    db[("DB\nSQLite / Postgres")]
    bus["Bus\nNATS JetStream"]
  end

  %% Agents & Integrations
  subgraph agents["Agents \(SDK-based\)"]
    qa[QA]
    be[Backend]
    fe[Frontend]
    docs[Docs]
  end

  gh["GitHub\nPRs / Checks / Labels / Webhooks"]

  %% Wires
  web --> api
  planner --> api

  api <---> db
  api <---> bus
  workers <---> bus
  qa --> bus
  be --> bus
  fe --> bus
  docs --> bus

  workers --> gh
  gh --> workers
  api --> gh
  gh --> api
```

```mermaid
sequenceDiagram
  autonumber
  participant U as User \(Director\)
  participant API as Orchestrator API
  participant Bus as Bus
  participant AG as Agent \(SDK\)
  participant CMP as Composer Worker
  participant GH as GitHub
  participant GATE as Approvals Worker

  U->>API: POST /coordinator/intake { task with manual approval rule }
  API->>API: Create Task → spawn Run \(running\)
  API-->>Bus: agents.{id}.work
  AG-->>Bus: logs / patch / status
  CMP-->>Bus: consume patch → branch \(+ PR\)
  GH-->>API: PR info
  API->>API: Task → awaiting-approvals

  U->>API: Manual approval \(e.g., POST /approvals/manual { taskId, approver:"director" }\)
  API->>GATE: Record manual verdict
  GATE->>GATE: Evaluate policy \(strict\)
  alt All rules satisfied
    GATE->>API: Task → done
  else Still pending
    GATE->>API: Remain awaiting-approvals
  end
```

```mermaid
sequenceDiagram
  autonumber
  participant API as Orchestrator API
  participant GH as GitHub
  participant GATE as Approvals Worker
  participant U as User \(Director\)

  GH-->>GATE: Webhook: checks = failed
  GATE->>GATE: Evaluate → not satisfied
  GATE->>API: Task stays awaiting-approvals; annotate reason
  U->>API: Trigger fix \(new Task/Run\) or re-run checks/labels
  GH-->>GATE: Webhook: checks = success
  GATE->>GATE: Evaluate → satisfied
  GATE->>API: Task → done
```
