"use client";

import { useEffect, useRef, useState } from "react";
import type { RunState } from "./runState";

export type LogLine = { text: string; error?: boolean };

type SandboxEvent =
  | { type: "log"; line: string; stream?: "out" | "error" }
  | { type: "delta"; text: string }
  | { type: "image"; dataUrl: string }
  | { type: "result"; text: string; answer?: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type CodeRun = {
  code: string;
  setCode: (c: string) => void;
  logs: LogLine[];
  answer: string;
  streamed: string;
  imageUrl: string;
  rawJson: string;
  totalTokens: number | null;
  state: RunState;
  ran: boolean;
  run: () => void;
};

/** Sent with each run so server-side error reports say which exercise broke. */
export type RunMeta = { topicId?: string; block?: "main" | "followUp" };

/**
 * Owns one editable code block and its run: streams output from /api/run,
 * collecting console logs, the returned result (answer + raw JSON), and the
 * token count. A lesson can use several of these for independent code blocks.
 */
export function useCodeRun(initialCode: string, meta?: RunMeta): CodeRun {
  const [code, setCode] = useState(initialCode);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [answer, setAnswer] = useState("");
  const [streamed, setStreamed] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [state, setState] = useState<RunState>("idle");
  const [ran, setRan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLogs([]);
    setAnswer("");
    setStreamed("");
    setImageUrl("");
    setRawJson("");
    setTotalTokens(null);
    setState("running");

    let res: Response;
    try {
      res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, topicId: meta?.topicId, block: meta?.block }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      fail(`Request failed: ${(err as Error).message}`);
      return;
    }

    if (!res.ok || !res.body) {
      fail(`Server error: ${res.status} ${res.statusText}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawError = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice("data:".length).trim();
          if (!json) continue;
          let event: SandboxEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }
          if (event.type === "log") {
            setLogs((prev) => [...prev, { text: event.line, error: event.stream === "error" }]);
            const t = extractTotalTokens(event.line);
            if (t !== null) setTotalTokens(t);
          } else if (event.type === "delta") {
            setStreamed((prev) => prev + event.text);
          } else if (event.type === "image") {
            setImageUrl(event.dataUrl);
          } else if (event.type === "result") {
            setRawJson(event.text);
            if (event.answer) setAnswer(event.answer);
            const t = extractTotalTokens(event.text);
            if (t !== null) setTotalTokens(t);
          } else if (event.type === "error") {
            sawError = true;
            setLogs((prev) => [...prev, { text: event.message, error: true }]);
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      fail(`Stream error: ${(err as Error).message}`);
      return;
    }

    setState(sawError ? "error" : "done");
    setRan(true);
  }

  function fail(message: string) {
    setLogs((prev) => [...prev, { text: message, error: true }]);
    setState("error");
    setRan(true);
  }

  return { code, setCode, logs, answer, streamed, imageUrl, rawJson, totalTokens, state, ran, run };
}

function extractTotalTokens(text: string): number | null {
  try {
    const obj = JSON.parse(text);
    const t = obj?.usage?.total_tokens ?? obj?.total_tokens;
    return typeof t === "number" ? t : null;
  } catch {
    return null;
  }
}
