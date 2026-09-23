# PanoPublish Instagram DM Automation

Production-grade, AI-powered Instagram Direct Message automation built specifically for **PanoPublish** (the SaaS platform for creating, managing, and publishing 360° virtual tours).

The system operates **strictly through your existing authenticated Brave browser session** using Chrome DevTools Protocol (CDP). It never asks for passwords, never automates login, never extracts session cookies, and never launches a separate or headless browser profile.

---

## Architecture Highlights

- **Interactive Web Analytics & Approval Dashboard**: Modern dark-mode web application running at `http://localhost:3000` showing live **DMs Sent**, **Replies Received**, **Reply Rate %**, **Pending Approvals Queue**, and **Indian Creator Discovery**.
- **Targeted Indian 360° Creator Outreach**: Dedicated discovery engine targeting Indian 360° photographers, Google Street View Trusted creators, and virtual tour agencies across Mumbai, Delhi, Bangalore, Hyderabad, Pune, etc., emphasizing Google Street View publishing and ₹100 Pay As You Go pricing.
- **Brave CDP Integration**: Reuses your already logged-in Instagram session via `http://127.0.0.1:9222`.
- **10-Layer Resilient DOM Discovery**: Scans inbox threads using ARIA roles, accessible names, visible text, href patterns, and fallback selectors instead of brittle CSS classes.
- **Strict Self-Reply Guard**: Uses multi-signal DOM alignment, "You sent" text markers, and persistent conversation memory to guarantee the system never replies to its own outgoing messages.
- **Deterministic Turn Deduplication**: Every incoming turn is hashed deterministically (`account + convId + sender + messageText`). No message turn can ever trigger duplicate replies.
- **Jaccard Repetition Guard**: Blocks sending semantically repetitive (>75% similarity) replies within the same thread.
- **PanoPublish Knowledge Engine**: Dynamically loads JSON specifications for product capabilities, camera workflows (Insta360, Ricoh, DSLRs), Google Street View publishing, and transparent pricing ($5.99, $15.99, $32.99, and ₹100 Pay As You Go).
- **Human Approval & Dry-Run First**: Operates by default with `DRY_RUN=true`, `APPROVAL_MODE=true`, and `POSTING_ENABLED=false`. All AI replies are queued for interactive review (`[A]pprove`, `[R]eject`, `[E]dit`, `[S]kip`).
- **Post-Send DOM Verification**: Every live send is verified in permanent DOM chat bubbles outside composer elements before being marked `SENT_VERIFIED`.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Brave CDP Setup](#2-brave-cdp-setup)
3. [How to Launch Brave with Remote Debugging](#3-how-to-launch-brave-with-remote-debugging)
4. [How to Keep Your Existing Logged-In Brave Session](#4-how-to-keep-your-existing-logged-in-brave-session)
5. [How to Configure .env](#5-how-to-configure-env)
6. [How to Connect Instagram](#6-how-to-connect-instagram)
7. [How to Run Dry-Run Mode](#7-how-to-run-dry-run-mode)
8. [How to View Pending AI Replies](#8-how-to-view-pending-ai-replies)
9. [How to Approve a Reply](#9-how-to-approve-a-reply)
10. [How to Enable Live Mode](#10-how-to-enable-live-mode)
11. [How to Stop Automation](#11-how-to-stop-automation)
12. [Troubleshooting](#12-troubleshooting)
13. [How to Add or Update PanoPublish Knowledge](#13-how-to-add-or-update-panopublish-knowledge)
14. [How to Add New FAQ Answers](#14-how-to-add-new-faq-answers)
15. [How Conversation Memory Works](#15-how-conversation-memory-works)

---

## 1. Installation

Clone or open this repository, then install the minimal dependencies:

```bash
cd "d:\DM Automation"
npm install
npm run setup
```

The `setup` script will automatically create your `.env` configuration file from `.env.example` and initialize the `data/`, `logs/`, and `knowledge/` directories.

---

## 2. Brave CDP Setup

The system attaches to your existing Brave browser via Chrome DevTools Protocol (CDP) on port `9222`.

Default CDP URL:
```env
BRAVE_CDP_URL=http://127.0.0.1:9222
```

---

## 3. How to Launch Brave with Remote Debugging

Close all running instances of Brave, then launch Brave from PowerShell or Command Prompt with the `--remote-debugging-port=9222` flag:

### Windows (PowerShell):
```powershell
& "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --remote-debugging-port=9222
```

### Windows (Command Prompt):
```cmd
"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --remote-debugging-port=9222
```

> **Tip**: You can create a desktop shortcut to Brave and append ` --remote-debugging-port=9222` to the Target field to launch it in debugging mode with a single click.

---

## 4. How to Keep Your Existing Logged-In Brave Session

When you launch Brave with `--remote-debugging-port=9222` without specifying a custom `--user-data-dir`, Brave loads your **default user profile**.

All your existing logins, cookies, tabs, and extensions remain completely intact:
- Open `https://www.instagram.com/` inside Brave.
- Log in normally with your credentials and 2FA.
- The automation connects via CDP to this existing session. It **never** sees or stores your password.

---

## 5. How to Configure .env

Open `.env` in your editor and configure the parameters:

```env
# 1. BRAVE CDP
BRAVE_CDP_URL=http://127.0.0.1:9222
DEFAULT_ACCOUNT_ID=instagram-account-1

# 2. AI PROVIDER (OpenAI-compatible)
AI_PROVIDER=openai
AI_API_KEY=your_openai_or_compatible_api_key_here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=1024

# 3. SAFETY CONTROLS (Defaults are safe)
DRY_RUN=true
APPROVAL_MODE=true
POSTING_ENABLED=false

# 4. CONSERVATIVE RATE LIMITING
MAX_DM_REPLIES_PER_HOUR=10
MAX_DM_REPLIES_PER_DAY=30
MIN_ACTION_DELAY_MS=15000
MAX_ACTION_DELAY_MS=45000

# 5. PRODUCT LINKS (Used when user asks for tutorial/signup)
PANO_PUBLISH_WEBSITE=https://panopublish.com
PANO_PUBLISH_SIGNUP=https://panopublish.com/signup
PANO_PUBLISH_TUTORIAL=https://panopublish.com/tutorials
```

*(Note: If you do not have an OpenAI API key configured initially, the system runs with a built-in contextual simulation engine, allowing full end-to-end testing without external API calls.)*

---

## 6. How to Connect Instagram

1. Ensure Brave is running with port 9222 open and Instagram is open in any tab.
2. Run the authentication check command:

```bash
npm run auth
```

Output when connected:
```
==============================================
       BRAVE INSTAGRAM AUTHENTICATION
==============================================
✓ Brave CDP Host   : http://127.0.0.1:9222
✓ Instagram URL    : https://www.instagram.com/direct/inbox/
✓ Page Title       : Instagram • Chats
✓ Status           : AUTHENTICATED
✓ Active Account   : @your_account
==============================================
```

If not logged in, the system reports:
`Instagram is not authenticated in the connected Brave session. Please log in manually.`

---

## 7. How to Run Dry-Run Mode

Dry-run mode runs the full cycle—scans the inbox, classifies messages, evaluates leads, drafts replies, logs everything—but **NEVER sends anything to Instagram**.

```bash
npm run dry-run
```

To scan your inbox:
```bash
npm run scan
```

To run AI analysis on all newly arrived DMs:
```bash
npm run analyze
```

---

## 8. How to View Pending AI Replies

To see the system status and count of pending approvals:
```bash
npm run status
```

Status output format:
```
==============================================
       PANOPUBLISH AUTOMATION STATUS
==============================================
Brave CDP                 : CONNECTED (http://127.0.0.1:9222)
Instagram                 : CONNECTED
Instagram authentication  : AUTHENTICATED (@panopublish)
DM conversations tracked  : 14
Incoming messages seen    : 8
AI analyzed               : 8
Pending approval          : 3
Replies sent (verified)   : 0
Human review required     : 1
Operating Mode            : DRY_RUN (Simulation)
Approval Mode             : ENABLED (Human in the loop)
Posting Allowed           : FALSE
==============================================
```

---

## 9. How to Approve a Reply

To review and approve replies interactively:

```bash
npm run approve
```

The interactive CLI displays each pending reply:
```
----------------------------------------------
[1/3] TARGET: @camera_creator
Incoming Message:
  "Hey, I have an Insta360 X3 and I want to start selling virtual tours."

AI Classification:
  Intent      : 360_PHOTOGRAPHER
  Temperature : WARM
  Reason      : User specified camera model and client goal.
Suggested Reply:
  "An Insta360 X3 is plenty to get started. The standard workflow is uploading your 360° panoramas, connecting the hotspots into a tour, and embedding it for your client. Are you building tours for real estate or local businesses?"

Action: [A]pprove | [R]eject | [E]dit | [S]kip | [Q]uit >
```

- Type **`A`** to approve and dispatch the message.
- Type **`E`** to enter custom reply text before sending.
- Type **`R`** to reject the proposal.
- Type **`S`** to skip for later review.
- Type **`Q`** to exit the approval queue.

---

## 10. How to Enable Live Mode

> [!CAUTION]
> Only enable live mode after thoroughly verifying behavior in dry-run mode.

To allow live browser message dispatch, edit `.env`:

```env
DRY_RUN=false
APPROVAL_MODE=false
POSTING_ENABLED=true
```

In live mode:
1. The system verifies that the latest message in the thread is still from the user.
2. Duplicate guard verifies this message turn has not been answered.
3. Rate limiter checks hourly and daily thresholds.
4. Human typing keystroke delays are simulated.
5. Enter is pressed to submit.
6. The actual DOM is read to confirm the message bubble appeared outside the composer.
7. Only after DOM confirmation is `SENT_VERIFIED` recorded.

---

## 11. How to Stop Automation

The CLI operates on a demand/batch model by default (`npm run scan`, `npm run analyze`, `npm run approve`).

If running a continuous loop (`npm run start`), simply press:
```
Ctrl + C
```
in your terminal. The process will cleanly detach from Brave without closing your browser or affecting your open tabs.

---

## 12. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `Brave CDP is not reachable at http://127.0.0.1:9222` | Brave is not running with `--remote-debugging-port=9222` | Close Brave completely and relaunch with the `--remote-debugging-port=9222` flag. |
| `Instagram is not authenticated` | Instagram is logged out in Brave | Open `instagram.com` inside your running Brave browser and log in manually. |
| `Duplicate blocked` | Message turn already answered | Normal protection preventing repetitive replies to the same message. |
| `Rate limit reached` | Hourly limit (default 10) reached | Wait for the cooldown window or adjust `MAX_DM_REPLIES_PER_HOUR` in `.env`. |
| `SEND_UNVERIFIED` | Chat bubble not confirmed in DOM within 15s | Check the Instagram tab in Brave to ensure account is not rate-restricted by Meta. |

---

## 13. How to Add or Update PanoPublish Knowledge

The AI loads product context dynamically on every turn from `knowledge/panopublish.json` and `knowledge/sales-guidelines.json`:

- To change pricing, edit `knowledge/panopublish.json`:
  ```json
  "pricing": {
    "subscription_plans": [ ... ],
    "pay_as_you_go": { "price": "₹100 per extra tour" }
  }
  ```
- To update tone or escalation rules, edit `knowledge/sales-guidelines.json`.
- Changes take effect **immediately** without restarting the application (`KnowledgeEngine` monitors file modification timestamps).

---

## 14. How to Add New FAQ Answers

Add new Q&A pairs to `knowledge/faq.json`:

```json
{
  "question": "Can I use DSLR HDR bracketed panoramas?",
  "answer": "Yes. PanoPublish accepts any standard equirectangular 360° JPEG or PNG image stitched from DSLR or mirrorless brackets."
}
```

The AI automatically absorbs new FAQs into its prompt context and uses them to answer technical queries accurately.

---

## 15. How Conversation Memory Works

All conversation states are atomically recorded in `data/state.json`:

- **Per-Conversation Metadata**: Tracks user handle, thread ID, stage (`DISCOVERY`, `EDUCATION`, `PRODUCT_INTRODUCTION`, etc.), detected intent, and lead temperature (`HOT`, `WARM`, `COLD`).
- **Turn Tracking**: Remembers whether PanoPublish was introduced, whether pricing was discussed, and links shared to prevent repeating information.
- **Safety History**: Maintains recent outgoing messages for each user to prevent repetitive responses.
- **Atomic Writes**: Uses temporary files with atomic rename to prevent corruption in the event of unexpected shutdowns.

---

## Verification & Automated Tests

To run the complete automated test suite (6 suites verifying self-reply prevention, duplicate guards, AI schemas, rate limiters, approval queues, and DOM bubble verifiers):

```bash
npm test
```

Expected output:
```
============================================================
       PANOPUBLISH AUTOMATION COMPLETE TEST SUITE
============================================================
TOTAL SUITES : 6
PASSED       : 6
FAILED       : 0
============================================================
🎉 ALL AUTOMATED SAFETY & LOGIC VERIFICATIONS PASSED!
```
