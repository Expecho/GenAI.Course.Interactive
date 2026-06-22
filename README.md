# GenAI Workshop

An interactive, web-based workshop for learning GenAI concepts hands-on. Each topic shows
editable TypeScript code that you run in the browser and watch the output **stream in live**.

## Stack

- **Next.js (App Router) + TypeScript** — single full-stack app
- **Monaco editor** — edit the example code in the browser
- **Azure AI Foundry** (`openai` SDK, v1 API) — the LLM, behind a server-side proxy
- **esbuild + node:vm in a worker_thread** — safely run the edited code server-side

## Security model

The edited code runs **on the server**, so the Azure key must never be reachable by it:

- The key lives only in the host process and is baked into a pre-built `client` that is injected
  into the sandbox. The sandbox can *call* `client` but cannot *read* the key string.
- The sandbox is a `node:vm` context running in a `worker_thread` with a hard timeout. It does
  **not** expose `process`, `require`, `import`, or arbitrary `fetch`.
- `node:vm` is not a perfect security boundary. This is acceptable for a **trusted workshop**.
  If you ever expose this publicly, upgrade `lib/sandboxWorker.ts` to use
  [`isolated-vm`](https://github.com/laverdet/isolated-vm) (same injection model, real V8 isolate).

## Setup

1. Copy the env template and fill in your Azure AI Foundry values:
   ```bash
   cp .env.local.example .env.local
   # edit .env.local: AZURE_AI_FOUNDRY_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT
   # ENDPOINT is your Foundry resource or project URL; the app reduces it to the
   # resource host and appends /openai/v1/. No api-version needed — v1 routes to latest GA.
   ```
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000.

## Using the workshop

1. Pick a topic in the left sidebar.
2. Read the description, then edit the code in the Monaco editor.
3. Press **Run** — the output panel streams the result live.

## Course content

The workshop starts with a short introduction, then walks through 17 hands-on topics. Most
topics include a runnable snippet, a checkpoint question, and a follow-up experiment.

| Topic | What it covers |
| --- | --- |
| Introduction | What the workshop is for, who it targets, and how to learn by editing and running small experiments. |
| 1 · Calling an LLM | Your first Responses API call, the response object, and how token usage maps to cost. |
| 2 · System & user prompts | How system prompts shape behaviour, how user prompts ask for work, and why output varies run to run. |
| 3 · State & memory | Why models are stateless, how chat history creates memory, and why long conversations cost more. |
| 4 · Reasoning models | How reasoning models spend hidden reasoning tokens to solve harder multi-step problems. |
| 5 · Tools & live data | How function calling connects a frozen model to live data such as time, APIs, and external systems. |
| 6 · Code interpreter | How the built-in code interpreter gives the model a Python sandbox to compute exact, verifiable answers instead of guessing. |
| 7 · MCP servers | How MCP exposes reusable tools over a standard protocol so models can discover and call them with less custom wiring. |
| 8 · Retrieval (RAG) | How to ground answers in private or current documents using retrieval, embeddings, and injected context. |
| 9 · Structured output | How to constrain model output with JSON schemas so applications get reliable machine-readable data. |
| 10 · Streaming | How streaming improves perceived responsiveness by showing output as it is generated. |
| 11 · Multimodal | How vision-capable models read images, turning them into input tokens with real cost implications. |
| 12 · Image generation | How image models differ from text models, including their separate API, output format, and pricing model. |
| 13 · Context windows | How input and output share one token budget, and why history, tools, and retrieved context compete for space. |
| 14 · Skills | How reusable, on-demand instructions keep prompts focused instead of loading every capability up front. |
| 15 · Guardrails, evals & tests | How to validate LLM features with runtime constraints, labelled eval sets, and regression tests. |
| 16 · Agent frameworks | How agent loops work, and what frameworks add for orchestration, memory, retries, and observability. |
| 17 · Multi-agent systems | How specialist agents can collaborate through an orchestrator, and where MCP and A2A fit in. |

## Adding a topic

Topics are data-driven — no infra changes needed. Append a `Topic` entry in
`src/workshop/topics.ts`:

```ts
{
  id: "tool-calling",
  title: "Tool calling",
  description: "Let the model call a function…",   // markdown shown above the editor
  defaultCode: `/* editable TS that uses the injected \`client\` and \`console\` */`,
}
```

The injected `client` and the streaming run pipeline already support tool calls and
`stream: true`, so future topics only need a new entry plus its default code.
