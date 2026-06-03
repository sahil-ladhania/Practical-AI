# Core Agent Loop — Component Map

> Renamed from `notes.txt`. Prior test note: agent ran successfully (June 4).

## High-level overview

An **agent** is not magic—it is a **loop**:

1. **Perceive** — send the user goal + conversation history to the LLM  
2. **Decide** — model returns either a final answer or requests tool(s)  
3. **Act** — your code runs those tools and feeds results back  
4. Repeat until the model stops calling tools or a **guard** stops the run  

Frameworks like **LangChain** and **LangGraph** wrap this same pattern (tools, executor, graph/state). This project strips that down to ~30 lines of loop logic so you can see what they abstract away.

**Stack:** plain Node.js, OpenAI Chat Completions + function calling, four filesystem/shell tools, CLI via `readline`.

---

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────┐
│  index.js          CLI — read user input, call runAgent     │
└────────────────────────────┬────────────────────────────────┘
                             │ userGoal
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  agent/core.js     while(true): guards → LLM → tools → loop │
│                    (Perceive → Decide → Act)                │
└───────┬──────────────────────────────┬──────────────────────┘
        │ TOOL_DEFINITIONS              │ executeTool(name, input)
        ▼                               ▼
┌───────────────────┐         ┌───────────────────────────────┐
│ tools/            │         │ tools/                        │
│ definitions.js    │         │ implementations.js            │
│ (schemas only)    │         │ (real read/write/shell code)  │
└───────────────────┘         └───────────────────────────────┘
        │                               │
        └─────────── LLM never runs ────┘
                    this code; only sees schemas
```

**One turn inside the loop:**

```
User prompt → [guards OK?] → OpenAI API (+ tool schemas)
                ↓
         tool_calls? ──no──→ return text to CLI
                │
               yes
                ↓
         print tool names → run implementations (parallel)
                ↓
         append assistant + tool messages → loop again
```

---

## File roles

| File | Role |
|------|------|
| `index.js` | Terminal UI: prompt loop, `runAgent(goal)`, print result |
| `agent/core.js` | Agent brain: `while(true)`, OpenAI calls, guards, message history |
| `tools/definitions.js` | **Contracts** the model reads (names, descriptions, JSON parameters) |
| `tools/implementations.js` | **Code** that actually runs when the model picks a tool |
| `.env` | `OPENAI_API_KEY` (local only, not committed) |
| `package.json` | `openai`, `dotenv` dependencies |

There is **no** `agent.ts`, `code.java`, or Java in this repo—everything is **JavaScript** (`.js`).

---

## Your specific questions

### Why a **definitions** file? What’s in it?

The LLM cannot run your filesystem. It only needs a **menu**: tool name, what it does, and what arguments look like (JSON Schema).

`tools/definitions.js` exports `TOOL_DEFINITIONS`—four OpenAI-style function tools:

- `read_file` — path  
- `write_file` — path + content  
- `list_directory` — path  
- `run_shell` — command (allowlisted in implementations)

**Nothing executes here.** It is documentation for the model, shaped so the API accepts it.

---

### Why a **tools** (implementations) file? What’s in it?

**Definitions = what the model is allowed to request.**  
**Implementations = what actually happens on your machine.**

`tools/implementations.js` contains:

- Four functions: `readFile`, `writeFile`, `listDirectory`, `runShell`  
- Safety: path stays under `process.cwd()`, shell command allowlist, timeouts, output caps  
- `executeTool(toolName, input)` — looks up the function in `TOOL_REGISTRY`, returns JSON `{ success, result }` or `{ success: false, error }`

The agent loop never imports tool logic except through `executeTool`.

---

### What is the **agent** file? (`agent/core.js`, not `agent.ts`)

`agent/core.js` is the **entire agent**:

- `runAgent(userGoal, options)` — entry used by `index.js`  
- Builds `messages`, calls `openai.chat.completions.create` with `tools: TOOL_DEFINITIONS`  
- **Decide:** if no `tool_calls`, return `message.content`  
- **Act:** parse `tool_calls`, run tools in parallel, push assistant + `role: 'tool'` messages, loop  
- **Guards:** max iterations, time limit, repetition detector (same tool + same args twice → stop)

This is the same “agent executor” role LangChain would call an **AgentExecutor** or a **graph node** in LangGraph.

---

### What is **`index.js`**? (not `code.java`)

`index.js` is the **CLI shell**—not part of reasoning:

- Loads `.env`  
- `readline` loop: `You ›` → `runAgent(input)` → `Agent ›`  
- Handles `exit` and errors  

No LLM calls here; it only starts the agent.

---

## How components interact (no line-by-line)

1. You type a goal in `index.js`.  
2. `core.js` sends it as the first `user` message.  
3. OpenAI responds with either text (done) or `tool_calls`.  
4. For each call, `core.js` logs `⟶ toolName({...})` and calls `executeTool` in `implementations.js`.  
5. Tool output strings go back as `tool` messages; full history is resent on the next iteration.  
6. The model may chain many tools (list dir → read file → answer) until it returns plain text.  
7. Guards prevent runaway cost (iteration cap, 2‑minute limit, duplicate-tool detection).

**Separation rule:** changing *how* `read_file` works → `implementations.js`. Changing *when* the model should use it → `definitions.js` (description + schema). Changing *loop policy* → `core.js`.

---

## Mental model vs frameworks

| This repo | LangChain-ish idea |
|-----------|-------------------|
| `definitions.js` | Tool schemas / structured tools |
| `implementations.js` | Tool callables |
| `agent/core.js` | Agent loop / executor |
| `index.js` | App / chat UI |

LangGraph adds explicit **state** and **edges** between nodes; the core idea remains: **model + tools + loop until stop**.

---

## Next step

If you want a **line-by-line** walkthrough, say which file to start with (`core.js` is usually best). This doc stays at the component level only.
