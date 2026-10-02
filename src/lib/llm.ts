import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * One switch for the model. Default: Qwen 3.8 27B on Groq (open weights, fast tool calling).
 *
 *   LLM_PROVIDER=groq               GROQ_API_KEY, LLM_MODEL (default qwen/qwen3.8-27b)
 *   LLM_PROVIDER=openrouter         OPENROUTER_API_KEY, LLM_MODEL (e.g. qwen/qwen-2.5-72b-instruct)
 *   LLM_PROVIDER=openai-compatible  OPENAI_COMPATIBLE_BASE_URL (e.g. Ollama http://localhost:11434/v1), LLM_MODEL
 */
const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

export const MODEL_ID = process.env.LLM_MODEL || (provider === "groq" ? "qwen/qwen3.8-27b" : "qwen/qwen-2.5-72b-instruct");
export const MODEL_LABEL = `${MODEL_ID} via ${provider}`;

export function chatModel(id: string = MODEL_ID) {
  switch (provider) {
    case "groq":
      return createGroq({ apiKey: process.env.GROQ_API_KEY })(id);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      })(id);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "custom",
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL || "http://localhost:11434/v1",
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
      })(id);
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
  }
}

/** Model used for generating custom sim code. Can be bigger/slower than the chat model. */
export const CODEGEN_MODEL_ID = process.env.LLM_CODEGEN_MODEL || MODEL_ID;
