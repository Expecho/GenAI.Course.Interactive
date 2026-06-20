/**
 * Source for the sandbox worker thread, kept as a string and launched with
 * `new Worker(WORKER_SOURCE, { eval: true })`. Shipping it as an eval string
 * (rather than a separate file) keeps it robust against Next.js bundling /
 * path rewriting at runtime.
 *
 * Runs as CommonJS inside the worker. Key-safety contract:
 *   - The Azure client is built HERE, in the worker's host scope, from creds.
 *   - The vm context receives ONLY `client` and a patched `console`.
 *   - `process`, `require`, `import`, and raw `fetch` are NOT in the vm scope,
 *     so the edited code can *call* `client` but cannot read the key string
 *     or the worker's environment.
 */
export const WORKER_SOURCE = /* js */ `
const vm = require("node:vm");
const util = require("node:util");
const { parentPort, workerData } = require("node:worker_threads");
const { OpenAI } = require("openai");

const { code, creds } = workerData;

function send(msg) {
  parentPort.postMessage(msg);
}

function fmt(args) {
  return args
    .map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: null, colors: false })))
    .join(" ");
}

// Built in the host scope — the key lives here, never enters the vm context.
// Azure AI Foundry's v1 API: plain OpenAI client + baseURL, no api-version.
const client = new OpenAI({
  baseURL: creds.baseURL,
  apiKey: creds.apiKey,
});

const sandboxConsole = {
  log: (...args) => send({ type: "log", line: fmt(args) }),
  info: (...args) => send({ type: "log", line: fmt(args) }),
  warn: (...args) => send({ type: "log", line: fmt(args), stream: "error" }),
  error: (...args) => send({ type: "log", line: fmt(args), stream: "error" }),
};

// \`write(...)\` streams text to the Answer panel live (used by the streaming
// topic): each call appends, with no newline.
const write = (...args) => send({ type: "delta", text: fmt(args) });

// \`showImage(x)\` renders an image in the Answer panel. Accepts a full URL, a
// data: URL, or raw base64 (assumed PNG, as image-generation models return).
const showImage = (x) => {
  let dataUrl = String(x || "");
  if (!/^(https?:|data:)/.test(dataUrl)) dataUrl = "data:image/png;base64," + dataUrl;
  send({ type: "image", dataUrl: dataUrl });
};

// Only these are reachable from the edited code. \`deployment\`,
// \`embeddingDeployment\`, and \`imageDeployment\` are the configured model names,
// injected so the snippets work out of the box.
const context = vm.createContext({
  client,
  console: sandboxConsole,
  deployment: creds.deployment,
  embeddingDeployment: creds.embeddingDeployment,
  imageDeployment: creds.imageDeployment,
  reasoningDeployment: creds.reasoningDeployment,
  write,
  showImage,
});

// \`code\` is already wrapped in an async IIFE by sandbox.ts (so top-level await
// and return both work) and transpiled to JS. Running it returns that promise.
try {
  const script = new vm.Script(code, { filename: "user-code.js" });
  Promise.resolve(script.runInContext(context))
    .then((value) => {
      // If the code returns a value (e.g. \`return res;\`), surface it as the
      // structured result: the raw JSON plus the answer text when present.
      if (value !== undefined && value !== null) {
        let text;
        try { text = JSON.stringify(value, null, 2); } catch (e) { text = String(value); }
        let answer;
        try {
          if (typeof value === "object" && typeof value.output_text === "string") answer = value.output_text;
        } catch (e) { /* no output_text getter */ }
        send({ type: "result", text: text, answer: answer });
      }
      send({ type: "done" });
    })
    .catch((err) => send({ type: "error", message: err && err.message ? err.message : String(err) }));
} catch (err) {
  send({ type: "error", message: err && err.message ? err.message : String(err) });
}
`;
