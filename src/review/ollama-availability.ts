/** The model this repository permits the local Ollama engine to run. */
export const OLLAMA_MODEL = "gpt-oss:20b" as const;

export type OllamaAvailabilityState = "ready" | "model-missing" | "daemon-unavailable";

export interface OllamaAvailability {
  readonly state: OllamaAvailabilityState;
  readonly model: typeof OLLAMA_MODEL;
}

/**
 * Parse the first (model-name) column from `ollama list` output.
 * This is deliberately tolerant of the optional table header and extra columns.
 */
export function parseOllamaList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
    .filter((name) => name && name.toUpperCase() !== "NAME");
}

export function ollamaAvailability(input: { listOutput?: string; listError?: string }): OllamaAvailability {
  if (input.listError !== undefined && input.listError.trim() !== "") {
    return { state: "daemon-unavailable", model: OLLAMA_MODEL };
  }
  return {
    state: parseOllamaList(input.listOutput ?? "").includes(OLLAMA_MODEL) ? "ready" : "model-missing",
    model: OLLAMA_MODEL,
  };
}

// Descriptive alias for callers that prefer the parser's purpose in its name.
export const parseOllamaAvailability = ollamaAvailability;
