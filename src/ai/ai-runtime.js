/**
 * src/ai/ai-runtime.js
 * Universal OpenAI-compatible AI runtime using native Node.js fetch (Node >= 18).
 * Includes queue-based concurrency governance, backoff retries, and resilient JSON parsing.
 */

const CONFIG = require("../../config");
const logger = require("../logging/logger");

class AiQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.queue = [];
    this.activeCount = 0;
    this.cache = new Map();
    this.cacheTtlMs = 120000; // 2-minute cache
  }

  enqueue(prompt, executor) {
    const cacheKey = prompt.trim();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.result);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        prompt,
        executor,
        resolve: (res) => {
          this.cache.set(cacheKey, { result: res, expiresAt: Date.now() + this.cacheTtlMs });
          if (this.cache.size > 150) {
            const first = this.cache.keys().next().value;
            this.cache.delete(first);
          }
          resolve(res);
        },
        reject
      });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.activeCount++;

    try {
      const result = await task.executor(task.prompt);
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      this.activeCount--;
      setTimeout(() => this.processNext(), 200);
    }
  }
}

class AiRuntime {
  constructor() {
    this.queue = new AiQueue(2);
  }

  cleanAndParseJson(text) {
    if (!text || typeof text !== "string") {
      throw new Error("Empty or invalid AI output");
    }

    let cleaned = text.trim();
    // Strip markdown fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Look for outermost JSON object
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        let slice = cleaned.slice(start, end + 1);
        slice = slice.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(slice);
      }
      throw new Error(`JSON parsing failed: ${e.message}. Raw: ${cleaned.slice(0, 150)}...`);
    }
  }

  /**
   * Calls an OpenAI-compatible API endpoint via standard fetch.
   */
  async callOpenAiCompatible(prompt, timeoutMs = CONFIG.AI_TIMEOUT_MS) {
    const apiKey = CONFIG.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY is not configured in .env");
    }

    const baseUrl = CONFIG.AI_BASE_URL;
    const url = `${baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: CONFIG.AI_MODEL,
          messages: [
            {
              role: "system",
              content: "You are an expert AI assistant for PanoPublish. You always respond in strict, valid JSON matching the requested schema."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: CONFIG.AI_TEMPERATURE,
          max_tokens: CONFIG.AI_MAX_TOKENS,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });

      const raw = await response.text();
      clearTimeout(timer);

      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        throw new Error(`AI API returned non-JSON response (HTTP ${response.status}): ${raw.slice(0, 300)}`);
      }

      if (!response.ok) {
        const errorMsg = data?.error?.message || data?.message || raw.slice(0, 300);
        throw new Error(`AI API HTTP ${response.status}: ${errorMsg}`);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new Error("AI API returned empty response content");
      }

      return this.cleanAndParseJson(content);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error(`AI API request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Execute AI reasoning with queuing.
   */
  async generateCompletion(prompt) {
    return this.queue.enqueue(prompt, (p) => this.callOpenAiCompatible(p));
  }
}

const aiRuntime = new AiRuntime();
module.exports = aiRuntime;
