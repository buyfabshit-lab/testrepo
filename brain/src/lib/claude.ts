import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Kind, Thought } from "./types";
import { KINDS } from "./types";

/**
 * The Claude half of the brain. Every function here is optional: with no API
 * key the app falls back to local heuristics and local retrieval, and nothing
 * in the UI breaks.
 *
 * The key is yours, it lives in this browser's localStorage, and it is sent
 * only to api.anthropic.com. That is why the browser flag below is set — this
 * is a single-user local-first app talking to the API with its own credential,
 * not a server handing out a shared key.
 */
const MODEL = "claude-opus-5";

function clientFor(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const EnrichmentSchema = z.object({
  title: z.string().describe("Three to seven words naming this thought. No trailing period."),
  kind: z.enum(KINDS as unknown as [Kind, ...Kind[]]).describe("What sort of thing this is."),
  tags: z
    .array(z.string())
    .describe("Two to five lowercase topic tags. Single words or hyphenated. Reusable across notes."),
  summary: z.string().describe("One sentence, under 140 characters, saying what this is about."),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;

const ENRICH_SYSTEM = `You label thoughts for a personal knowledge canvas.

Tags are the whole point: they are what pulls related bubbles together, so
prefer tags the person will reuse ("mortgage", "hiring", "sleep") over tags that
apply to exactly one note ("tuesday-call-with-sam"). Reuse a tag from the
existing vocabulary whenever it genuinely fits rather than inventing a synonym.

Keep the person's own vocabulary. Do not editorialise, do not give advice, and
do not rewrite what they wrote — you are labelling it, not improving it.`;

/** Title, tag, and classify one captured thought. */
export async function enrich(
  apiKey: string,
  thought: Thought,
  vocabulary: string[],
): Promise<Enrichment> {
  const known = vocabulary.slice(0, 60);
  const response = await clientFor(apiKey).messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: ENRICH_SYSTEM,
    output_config: {
      format: zodOutputFormat(EnrichmentSchema),
      // Labelling one short note is not hard work; keep it fast and cheap.
      effort: "low",
    },
    messages: [
      {
        role: "user",
        content: [
          known.length ? `Tags already in use: ${known.join(", ")}` : "No tags in use yet.",
          "",
          "Label this thought:",
          thought.text,
        ].join("\n"),
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude returned a label that did not match the schema.");
  return {
    ...parsed,
    tags: parsed.tags.map((tag) => tag.toLowerCase().trim().replace(/\s+/g, "-")).filter(Boolean),
  };
}

const ASK_SYSTEM = `You are the recall layer of someone's second brain.

You will be given the notes from their brain that best match their question,
each with an id. Answer from those notes and from them only. Cite the notes you
used inline as [id] — the canvas turns each citation into a highlighted bubble,
so a claim without a citation is a claim they cannot trace.

If the notes do not answer the question, say exactly what is missing instead of
filling the gap from general knowledge. Guessing is worse than useless here:
they will read it back later as something they wrote down.

Be brief. Two or three sentences is usually right. These are their own notes —
they do not need them summarised back at length.`;

export type AskResult = { text: string; citedIds: string[] };

/**
 * Answer a question over the retrieved thoughts, streaming tokens as they land.
 * Retrieval happens locally before this is called — Claude only ever sees the
 * handful of notes that matched.
 */
export async function ask(
  apiKey: string,
  question: string,
  context: Thought[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<AskResult> {
  const notes = context
    .map((thought) =>
      [
        `[${shortId(thought.id)}] ${thought.title}`,
        `kind: ${thought.kind}${thought.tags.length ? ` · tags: ${thought.tags.join(", ")}` : ""}`,
        `captured: ${new Date(thought.createdAt).toISOString().slice(0, 10)}`,
        thought.text,
      ].join("\n"),
    )
    .join("\n\n---\n\n");

  const stream = clientFor(apiKey).messages.stream(
    {
      model: MODEL,
      max_tokens: 64000,
      system: ASK_SYSTEM,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: notes
            ? `Notes from my brain:\n\n${notes}\n\n---\n\nMy question: ${question}`
            : `My brain has no notes matching this yet.\n\nMy question: ${question}`,
        },
      ],
    },
    { signal },
  );

  stream.on("text", onDelta);
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(message.stop_details?.explanation ?? "Claude declined to answer that.");
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, citedIds: citedIds(text, context) };
}

/** Bubbles are cited by a short prefix; map those back to full ids. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

function citedIds(text: string, context: Thought[]): string[] {
  const cited = new Set<string>();
  for (const match of text.matchAll(/\[([0-9a-f-]{4,36})\]/gi)) {
    const needle = match[1].toLowerCase();
    const hit = context.find((thought) => thought.id.startsWith(needle));
    if (hit) cited.add(hit.id);
  }
  return [...cited];
}

/** Turn an SDK error into one line a person can act on. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "That API key was rejected. Check it in settings.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Rate limited by the API — try again in a moment.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `The API rejected the request: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach api.anthropic.com. Check your connection.";
  }
  if (error instanceof Anthropic.APIError) {
    return `API error ${error.status}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
