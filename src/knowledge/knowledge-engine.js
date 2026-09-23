/**
 * src/knowledge/knowledge-engine.js
 * Dynamic knowledge engine for PanoPublish.
 * Dynamically loads and caches JSON documents with file modification tracking (mtimeMs).
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");
const logger = require("../logging/logger");

class KnowledgeEngine {
  constructor(knowledgeDir = CONFIG.KNOWLEDGE_DIR) {
    this.knowledgeDir = knowledgeDir;
    this.cache = new Map(); // filename -> { mtime, data }
    this.lastChecked = 0;
    this.checkIntervalMs = 2000;
    this.loadAll();
  }

  loadAll(force = false) {
    const now = Date.now();
    if (!force && now - this.lastChecked < this.checkIntervalMs && this.cache.size > 0) {
      return;
    }
    this.lastChecked = now;

    if (!fs.existsSync(this.knowledgeDir)) {
      logger.warn(`Knowledge directory not found at: ${this.knowledgeDir}`);
      return;
    }

    try {
      const files = fs.readdirSync(this.knowledgeDir).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const fullPath = path.join(this.knowledgeDir, file);
        const stats = fs.statSync(fullPath);
        const cached = this.cache.get(file);
        if (!cached || cached.mtime !== stats.mtimeMs || force) {
          const raw = fs.readFileSync(fullPath, "utf8");
          try {
            const data = JSON.parse(raw);
            this.cache.set(file, {
              mtime: stats.mtimeMs,
              data
            });
          } catch (jsonErr) {
            logger.error(`Error parsing knowledge file ${file}`, jsonErr);
          }
        }
      }
    } catch (err) {
      logger.error("Error reading knowledge directory:", err);
    }
  }

  getKnowledge(filename) {
    this.loadAll(false);
    const cached = this.cache.get(filename);
    return cached ? cached.data : null;
  }

  getPanoPublishInfo() {
    return this.getKnowledge("panopublish.json") || {};
  }

  getSalesGuidelines() {
    return this.getKnowledge("sales-guidelines.json") || {};
  }

  getTargetAudiences() {
    return this.getKnowledge("target-audience.json") || {};
  }

  getFaqs() {
    return this.getKnowledge("faq.json") || { faqs: [] };
  }

  getProductLinks() {
    return {
      website: CONFIG.PANO_PUBLISH_WEBSITE,
      signup: CONFIG.PANO_PUBLISH_SIGNUP,
      tutorial: CONFIG.PANO_PUBLISH_TUTORIAL
    };
  }

  /**
   * Builds a concise prompt context string representing the active knowledge base.
   */
  getAiContextString() {
    this.loadAll(false);
    const product = this.getPanoPublishInfo();
    const guidelines = this.getSalesGuidelines();
    const links = this.getProductLinks();
    const faqs = this.getFaqs().faqs || [];

    return `
--- PANOPUBLISH KNOWLEDGE BASE ---
PRODUCT: ${product.product?.name || "PanoPublish"} (${product.product?.category || "360 Virtual Tour SaaS"})
POSITIONING: "${product.product?.positioning || ""}"
TAGLINE: "${product.product?.tagline || ""}"
WORKFLOW: ${(product.workflow || []).join(" -> ")}
SUPPORTED HARDWARE: ${(product.supported_hardware || []).join(", ")}
PRICING CONTEXT:
  - Starter: $5.99/mo
  - Pro: $15.99/mo
  - Agency: $32.99/mo
  - Pay As You Go: ₹100 per extra tour credit (never expire)
  - Rule: Only quote pricing when the user asks. Never invent discounts.
OFFICIAL LINKS (Single useful link rule: only share if directly requested or helpful):
  - Website: ${links.website}
  - Signup: ${links.signup}
  - Tutorial: ${links.tutorial}

SALES GUIDELINES:
  - Voice: ${guidelines.tone_and_demeanor?.voice || "Conversational, direct, human, helpful, zero hype."}
  - Conversation Rules: ${(guidelines.conversation_rules || []).join(" | ")}
  - Never pitch immediately on initial contact. First understand their camera, project, or need.

COMMON FAQS:
${faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}
----------------------------------
`.trim();
  }
}

const knowledgeEngine = new KnowledgeEngine();
module.exports = knowledgeEngine;
