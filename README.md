# GenAI Workshop

An interactive, web-based workshop for learning GenAI concepts hands-on. Each topic shows
editable TypeScript code that you run in the browser and watch the output **stream in live**.

It replaces the static `AzureOpenAI.ipynb` C# notebook with a live full-stack app.

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
