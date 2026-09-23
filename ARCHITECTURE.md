# PanoPublish Instagram DM Automation Architecture

## 1. Executive Summary & Source Code Audit

A thorough inspection of the reference repository (`https://github.com/sunmughan/meta-automation`) was conducted to evaluate its architecture, modularity, and production-readiness for PanoPublish.

### Key Findings from `meta-automation`

1. **Browser Layer (`src/browser/browser-manager.js`)**:
   - Uses `puppeteer-core` connecting via Chrome DevTools Protocol (CDP) to an existing browser session (`http://127.0.0.1:9222`).
   - Reuses already opened tabs, discovers tabs matching URLs, and supports reconnect retries.
   - Clears device metrics and handles unexpected browser dialogs.
   - **Status**: Strong foundation, but currently couples Threads, LinkedIn, and Facebook with Instagram into a single monolithic class.

2. **Instagram DM & Interaction Layer (`src/platforms/instagram/`)**:
   - `instagram-auth.js` checks authenticated DOM markers (`/direct/inbox/`, direct messages icons, profile avatars) vs login forms.
   - `instagram-dms.js` was an incomplete stub (70 lines) that merely scraped two lines of text from `/direct/inbox/` thread list items. It lacked thread navigation, message turn extraction, deep conversation history parsing, and layered DOM selectors.
   - `instagram-actions.js` had no live DM sending implementation for Instagram (only a placeholder).
   - **Status**: Needs a complete rewrite for production-grade Instagram DM scanning, bubble parsing, incoming vs outgoing distinction, and DOM-verified message sending.

3. **Safety & Deduplication (`src/safety/`)**:
   - `duplicate-guard.js` provides deterministic hashing (SHA-256) and Jaccard word-overlap similarity (>75%) to block repetitive messages within a thread and across actions.
   - `rate-limiter.js` tracks hourly and daily actions in sliding windows with human delay jitter.
   - **Status**: Conceptually sound and directly reusable with adaptations for account-aware DM turn hashing.

4. **Action Verifier (`src/agent/action-verifier.js`)**:
   - Enforces post-condition verification by polling the DOM outside draft/editable elements to ensure messages were committed.
   - Records verification telemetry.
   - **Status**: Highly valuable concept. Will be adapted specifically for Instagram DM chat bubbles.

5. **AI Reasoning Runtime (`src/ai/`)**:
   - Clean native `fetch` client supporting OpenAI-compatible APIs (OpenAI, DeepSeek, Groq, Ollama, etc.) and MiniMax with structured JSON parsing, code fence stripping, and concurrency queueing.
   - **Status**: Excellent foundation. Will be cleanly adapted to OpenAI-compatible format with strict PanoPublish qualification schemas.

6. **State Storage (`src/storage/state-store.js`)**:
   - Atomic file writes using temporary files and atomic rename to avoid corruption.
   - Tracks posts, conversations, messages, actions, and statistics.
   - **Status**: Solid pattern. Will be refactored to focus cleanly on conversation threads, lead qualification, and DM approval states.

---

## 2. Reusability Matrix

| Component | Source Status in `meta-automation` | Action for PanoPublish |
| :--- | :--- | :--- |
| **CDP Connection** | Functional in `browser-manager.js` | **Adapt & Refactor**: Isolate into clean `BraveBrowserManager`, add multi-account awareness, strict Brave connection checks. |
| **Instagram Auth** | Basic check in `instagram-auth.js` | **Adapt & Enhance**: Detect active logged-in profile handle, check inbox accessibility, enforce manual login warnings. |
| **Instagram DM Scanner** | Incomplete stub in `instagram-dms.js` | **Rewrite Completely**: 10-layer selector discovery, inbox thread navigation, conversation history reading, incoming/outgoing detection. |
| **Instagram DM Sender** | Not implemented | **Build Clean**: Keystroke typing simulation, enter/click submission, post-condition DOM bubble verification. |
| **Duplicate Guard** | Good logic in `duplicate-guard.js` | **Adapt & Enhance**: Deterministic DM turn hash (`account + threadId + sender + content`), Jaccard similarity. |
| **Rate Limiter** | Good sliding window in `rate-limiter.js` | **Adapt**: Configurable hourly/daily limits and jitter delays for Instagram DMs. |
| **Action Verifier** | General verifier in `action-verifier.js` | **Adapt**: Specific DOM verifier for Instagram chat bubbles outside contenteditable composers. |
| **AI Runtime** | OpenAI & MiniMax fetch runtime | **Adapt**: OpenAI-compatible client, structured JSON output validation, strict schema checking. |
| **State Store** | Atomic JSON store in `state-store.js` | **Adapt**: Focus on conversations, lead scoring, message histories, and approval queue. |
| **Threads/LinkedIn/FB** | Extraneous code throughout repo | **Remove Completely**: Zero clutter from non-Instagram platforms. |
| **Job Hunter/Resume** | Extraneous job application agent | **Remove Completely**: Not relevant to PanoPublish SaaS outreach. |

---

## 3. PanoPublish System Architecture

```
                                  +-----------------------------+
                                  |     Brave Browser Session   |
                                  | (Already Logged In Profile) |
                                  +--------------+--------------+
                                                 |
                                     CDP (127.0.0.1:9222)
                                                 |
+------------------------------------------------v-----------------------------------------------+
|                                    PanoPublish DM Automation                                   |
|                                                                                                |
|   +-----------------------+     +-----------------------+     +----------------------------+   |
|   |  BraveBrowserManager  |---->|   InstagramScanner    |---->|   MessageClassifier        |   |
|   |  (CDP / Tab Control)  |     | (Layered DOM Discovery|     |   (Incoming vs Outgoing)   |   |
|   +-----------------------+     +-----------------------+     +--------------+-------------+   |
|                                                                              |                 |
|   +-----------------------+     +-----------------------+                    v                 |
|   |   PanoPublish KB      |---->|    AiDecisionEngine   |<---------[ Deterministic Turn Hash ] |
|   | (JSON Knowledge Base) |     |  (Intent, Lead Temp,  |                                      |
|   +-----------------------+     |   Stage, Generation)  |                                      |
|                                 +-----------+-----------+                                      |
|                                             |                                                  |
|                                             v                                                  |
|                                 +-----------------------+                                      |
|                                 |    DuplicateGuard &   |                                      |
|                                 |     Safety Filter     |                                      |
|                                 +-----------+-----------+                                      |
|                                             |                                                  |
|                      +----------------------+----------------------+                           |
|                      |                                             |                           |
|            [ APPROVAL_MODE=true ]                        [ LIVE MODE (When explicitly set) ]   |
|                      |                                             |                           |
|                      v                                             v                           |
|          +-----------------------+                     +-----------------------+               |
|          | Pending Approval Q    |                     |     RateLimiter       |               |
|          | (CLI: Approve/Reject/ |                     +-----------+-----------+               |
|          |  Edit/Skip)           |                                 |                           |
|          +-----------+-----------+                                 v                           |
|                      |                                 +-----------------------+               |
|                      +-------------[ User Approves ]-->|   InstagramSender     |               |
|                                                        | (Typing + Submission) |               |
|                                                        +-----------+-----------+               |
|                                                                    |                           |
|                                                                    v                           |
|                                                        +-----------------------+               |
|                                                        |     ActionVerifier    |               |
|                                                        | (DOM Bubble Verify)   |               |
|                                                        +-----------+-----------+               |
|                                                                    |                           |
|                                                                    v                           |
|                                                        +-----------------------+               |
|                                                        |   StateStore & Logs   |               |
|                                                        | (SENT_VERIFIED status)|               |
|                                                        +-----------------------+               |
+------------------------------------------------------------------------------------------------+
```

---

## 4. Layered Instagram DOM Discovery Architecture

Instagram's web interface changes class names periodically. To prevent breakage, our extraction pipeline implements a 10-layer resilient discovery strategy:

1. **ARIA Roles**: `[role="listitem"]`, `[role="row"]`, `[role="gridcell"]`, `[role="main"]`.
2. **Accessible Names**: `aria-label*="Direct"`, `aria-label*="Messages"`, `aria-label*="Chats"`, `aria-label*="unread"`.
3. **Visible Text & Badges**: Unread count badges, sender title hierarchy, time stamps.
4. **Href Matching**: Links matching `/\/direct\/t\/([a-zA-Z0-9_-]+)/` or `/\/direct\/inbox\//`.
5. **Semantic Attributes**: `dir="auto"`, `contenteditable="true"`, `tabindex`.
6. **DOM Structure Hierarchy**: Conversation container -> Message list container -> Message row -> Bubble container -> Text span.
7. **Incoming vs Outgoing Distinction**:
   - Outgoing indicators: Right-aligned flex styling (`justify-content: flex-end`, `align-self: flex-end`), Meta blue/purple bubble gradient classes, "You sent" text markers, comparison against `stateStore.getRecentOutgoingMessages()`.
   - Incoming indicators: Left-aligned flex styling, sender profile picture adjacency, standard dark/light background.
   - Uncertainty rule: If ambiguous, immediately flag `HUMAN_REVIEW_REQUIRED` and block reply.
8. **Fallback Selectors**: Maintained list of secondary selector paths if primary ARIA roles are missing.
9. **URL Context Validation**: Verification that current page URL is within `instagram.com/direct/`.
10. **Post-Condition Verification**: Inspecting DOM changes after navigation and message entry.

---

## 5. PanoPublish Knowledge Base & Domain Mapping

Dynamic JSON documents loaded by `KnowledgeEngine`:

- `knowledge/panopublish.json`:
  - Product positioning: "Create, manage and publish professional 360° virtual tours."
  - Tagline: "Shoot. Create. Publish. Earn."
  - Workflows: 360° photography -> upload panoramas -> organize scenes -> connect scenes -> create virtual tour -> multi-level tours -> nadir branding -> publish/embed -> Google Street View publishing.
  - Alternatives: Matterport, CloudPano, Marzipano (factual, no unsupported superiority claims).
  - Pricing: $5.99, $15.99, $32.99 monthly plans. Pay-As-You-Go at ₹100 per extra tour credit (never expire). Only quoted when relevant.
- `knowledge/sales-guidelines.json`:
  - Tone: Helpful, natural, consultative, conversational, zero-hype.
  - Rules: Never pitch aggressively on the first turn; understand user's camera/use case first; single useful link discipline.
  - Links: Configurable through environment (`PANO_PUBLISH_WEBSITE`, `PANO_PUBLISH_SIGNUP`, `PANO_PUBLISH_TUTORIAL`).
- `knowledge/target-audience.json`:
  - Segment definitions: 360 photographers, Google Street View photographers, real estate photographers, agencies, hotels/resorts, local businesses.
- `knowledge/faq.json`:
  - Curated answers to common technical, workflow, camera compatibility (Insta360, Ricoh Theta, DSLRs), and publishing questions.

---

## 6. Directory Structure

```
d:/DM Automation/
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── README.md
├── package.json
├── config.js
├── knowledge/
│   ├── panopublish.json
│   ├── sales-guidelines.json
│   ├── target-audience.json
│   └── faq.json
├── src/
│   ├── browser/
│   │   ├── brave-browser-manager.js
│   │   └── accounts-manager.js
│   ├── instagram/
│   │   ├── instagram-auth.js
│   │   ├── instagram-scanner.js
│   │   ├── instagram-sender.js
│   │   └── message-classifier.js
│   ├── ai/
│   │   ├── ai-runtime.js
│   │   └── ai-decision-engine.js
│   ├── knowledge/
│   │   └── knowledge-engine.js
│   ├── safety/
│   │   ├── duplicate-guard.js
│   │   ├── rate-limiter.js
│   │   └── action-verifier.js
│   ├── storage/
│   │   └── state-store.js
│   ├── approval/
│   │   └── approval-manager.js
│   ├── telemetry/
│   │   └── action-telemetry.js
│   └── logging/
│       └── logger.js
├── cli/
│   └── panopublish-cli.js
└── tests/
    ├── test-auth.js
    ├── test-message-classification.js
    ├── test-duplicate-guard.js
    ├── test-ai-engine.js
    ├── test-rate-limiter.js
    ├── test-approval-flow.js
    └── test-action-verifier.js
```

---

## 7. Execution Modes & Safety Guarantees

- **Default Safety Posture**:
  - `DRY_RUN=true`
  - `APPROVAL_MODE=true`
  - `POSTING_ENABLED=false`
- **Zero Automated Login**: System never touches passwords, 2FA, or cookies. Brave is the single source of authentication.
- **Self-Reply Guard**: Strict checks guarantee the system never replies to its own outgoing messages.
- **Duplicate Guard**: Deterministic hashing guarantees no message turn generates more than one reply.
- **Verification Guarantee**: Every live send is verified in permanent DOM before being marked `SENT_VERIFIED`.
