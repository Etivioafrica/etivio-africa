import "server-only";

// Every AI call goes through here (Cloudflare Workers AI today). Swapping provider means changing this file only.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const AI_MODELS = {
  // Learner chat: fast, streams well.
  chat: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  // Tutor writing tools: slower, best at structured output.
  write: "@cf/openai/gpt-oss-120b",
  thumbnail: "@cf/black-forest-labs/flux-1-schnell",
} as const;

const endpoint = (model: string) => `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

// Questions a learner can ask the study assistant per 24 hours.
export const LESSON_CHAT_DAILY_LIMIT = 40;
// Questions per 24 hours for the Etivio AI widget in the app.
export const ASSISTANT_DAILY_LIMIT = 30;

export const aiConfigured = () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN);

async function run(model: string, body: Record<string, unknown>) {
  const res = await fetch(endpoint(model), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return res;
}

// Text from one streamed or finished chunk, whichever shape the model answers in.
function textOf(chunk: { response?: unknown; choices?: { delta?: { content?: string }; message?: { content?: string } }[] }) {
  if (typeof chunk.response === "string") return chunk.response;
  return chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
}

// Streams the reply as plain text. `onDone` gets the full text once it finishes (to save it). The model's reply is
// read to the end on the server even if the browser stops listening (refresh, closed tab), so it's always saved;
// `done` settles after that, for the route to hand to after() so the save isn't cut off.
export async function aiStream(messages: ChatMessage[], { maxTokens = 900, onDone }: { maxTokens?: number; onDone?: (full: string) => Promise<void> | void } = {}) {
  const res = await run(AI_MODELS.chat, { messages, max_tokens: maxTokens, stream: true });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let listening = true;
  let markDone: () => void = () => {};
  const done = new Promise<void>((resolve) => (markDone = resolve));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let full = "";
      const send = (text: string) => {
        if (!listening) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          listening = false;
        }
      };
      try {
        read: for (;;) {
          const { done: ended, value } = await reader.read();
          if (ended) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const data = line.startsWith("data: ") ? line.slice(6).trim() : "";
            if (data === "[DONE]") break read;
            if (!data) continue;
            try {
              const chunk = JSON.parse(data);
              const piece = textOf(chunk);
              if (piece) {
                full += piece;
                send(piece);
              }
              // The last chunk says why it stopped; the connection doesn't always close promptly after it.
              if (chunk.choices?.[0]?.finish_reason || chunk.usage) break read;
            } catch {}
          }
        }
      } catch {
        // Connection dropped mid-reply: keep what arrived.
      }
      reader.cancel().catch(() => {});
      try {
        await onDone?.(full);
      } finally {
        if (listening) {
          try {
            controller.close();
          } catch {}
        }
        markDone();
      }
    },
    cancel() {
      // The browser went away; the reply is still read to the end above and saved.
      listening = false;
    },
  });
  return Object.assign(stream, { done });
}

export async function aiText(messages: ChatMessage[], { model = AI_MODELS.write, maxTokens = 1500 }: { model?: string; maxTokens?: number } = {}) {
  // The writing model "thinks" before answering; low effort keeps that short so the budget goes to the answer.
  const res = await run(model, { messages, max_tokens: maxTokens + 1000, ...(model === AI_MODELS.write ? { reasoning_effort: "low" } : {}) });
  const json = (await res.json()) as { result?: Parameters<typeof textOf>[0] };
  const text = textOf(json.result ?? {}).trim();
  if (!text) throw new Error("The AI didn't return an answer. Try again.");
  return text;
}

// Asks for JSON and parses it, tolerating code fences or a sentence around it.
export async function aiJson<T>(messages: ChatMessage[], opts?: { model?: string; maxTokens?: number }): Promise<T> {
  const text = await aiText(messages, opts);
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("The AI didn't return usable output. Try again.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// A square image as JPEG bytes.
export async function aiImage(prompt: string) {
  const res = await run(AI_MODELS.thumbnail, { prompt, steps: 6 });
  const json = (await res.json()) as { result?: { image?: string } };
  if (!json.result?.image) throw new Error("The image couldn't be generated. Try again.");
  return Buffer.from(json.result.image, "base64");
}

// Course text for prompts: tags stripped, length capped so prompts stay small.
export const promptText = (html: string | null | undefined, max = 6000) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
