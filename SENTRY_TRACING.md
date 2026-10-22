# Sentry Agent Tracing Guide

## Overview

Snooze Desk uses **Sentry AI Monitoring** to trace AI inference calls, GitHub API calls, and workflow steps. This satisfies the "Best Use of Sentry Agent Tracing" category requirement.

## Setup

### 1. Get a Free Sentry DSN

1. Sign up at [sentry.io](https://sentry.io) (free tier)
2. Create a new Next.js project
3. Copy your DSN from Project Settings

### 2. Configure Environment

Add your DSN to `.env`:

```bash
SENTRY_DSN=https://your-key@sentry.io/your-project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id
```

Both are read at init. `tracesSampleRate` is `1.0`. Empty DSN disables the SDK. Restart `pnpm dev` after changing env.

### 3. What Gets Traced

All AI and activity operations are automatically instrumented:

#### AI Inference Spans (`ai.inference`)
- **Operation**: `classify_notification`, `generate_digest_summary`
- **Attributes**:
  - `ai.model`, `gen_ai.system` (`ollama`), `gen_ai.request.model`
  - `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.total_tokens` (from Ollama `prompt_eval_count` and `eval_count`)
  - `ollama.total_duration_ms`, `ollama.load_duration_ms`, `ollama.prompt_eval_duration_ms`, `ollama.eval_duration_ms`
  - `ai.classification`, `ai.has_draft`, `ai.prompt_version`, `ai.internal_attempt`
  - `notification.id`, `notification.type`, `notification.reason`
  - `temporal.workflow_id`, `temporal.activity_type`, `temporal.attempt`
- Each Ollama call shows up as an auto instrumented `http.client` child span (`POST 127.0.0.1`).
- If Ollama is unreachable after 3 in activity attempts, the span is marked `error` (`ollama_unreachable`) and the activity throws so Temporal retries it (1s initial interval, max 3 attempts).

#### Activity Spans (`ai.activity`)
- **Operation**: `fetch_github_notifications`, `post_github_comment`

#### HTTP Spans (`http.server`)
- **Operation**: `api.start_workflow`, `api.approve_draft`, `api.snooze_draft`
- **Attributes**: Endpoint, status code, duration

## Performance Measurements

**measured Oct 22, 2026 on a CPU-only Linux box**

Live run, 8 vCPU Intel Xeon, no GPU, Ollama 0.40.8. 6 demo fixture notifications went through the real Temporal workflow and real Ollama inference. Fixtures were used instead of the GitHub API because no GitHub token was available. Every number below comes from span attributes that Sentry ingest accepted (HTTP 200 for all 54 envelopes).

| Model | Prompt | Classify wall ms, mean (min to max) | Input tokens, mean | Output tokens, mean | Eval speed | Digest wall ms | Correct labels |
|---|---|---|---|---|---|---|---|
| gemma3:1b | v1 | 1734 (1502 to 2081) | 215 | 71 | 44.3 tok/s | 1390 | 3/6 |
| gemma3:1b | v2 | 2926 (2417 to 3276) | 351 | 88 | 45.9 tok/s | 1991 | 3/6 |
| gemma4:e4b | v1 | 58123 (41556 to 71342) | 222 | 428 | 7.8 tok/s | 56679 | 5/6 |
| gemma4:e4b | v2 | 49195 (37485 to 65936) | 358 | 414 | 8.8 tok/s | 53766 | 6/6 |

- Cold model load showed up as `ollama.load_duration_ms`: 12745 ms for the first gemma4:e4b call, 2291 ms for gemma3:1b right after an Ollama restart, 1 to 14 ms when warm.
- Almost all of the time is `eval_duration` (token generation), not prompt processing.
- Workflow wall time includes the 15 s approval signal loop of the run script, so it is not pure inference time.

### What the traces found
- **gemma3:1b labels everything `needs-you`.** With the original prompt (v1) it marked all 6 notifications `needs-you`, including `FREE GITHUB STARS! Click here now!!!` and a dependabot style lodash bump. A stricter prompt with few shot examples and a JSON schema enforced by Ollama (v2) did not change that, so this is a model capacity limit, not a prompt bug.
- **gemma4:e4b plus prompt v2 got 6/6.** With v1 it got 5/6 and still marked a `subscribed` praise discussion as `needs-you`. v2 fixed that.
- Recommendation: use gemma4:e4b for `classify_notification`. gemma3:1b is fine for `generate_digest_summary`, which is free text.

## Error and retry evidence (run D)

Workflow `notification-processor-1792692082337`, trace `7c93349423c940d88d49e00f027c6900`. **measured Oct 22, 2026 on a CPU-only Linux box**

Ollama was stopped during the first `classify_notification`. Attempt 1 made 3 HTTP calls (`SocketError: other side closed`, then `ECONNREFUSED`), ended with span status `error`, and threw. Temporal retried, and attempt 2 (`temporal.attempt = 2`) succeeded after Ollama came back, paying a 2291 ms cold load. Sentry received the error events and both segment spans in the same trace.

| What | UTC | IST |
|---|---|---|
| Workflow started | 18:01:22.288 | 23:31:22.288 |
| classify_notification attempt 1 span start | 18:01:22.420 | 23:31:22.420 |
| `pkill ollama` | 18:01:23.315 | 23:31:23.315 |
| Sentry error event `6d83f40eca7b42649cceeaef3ded55cc`: `SocketError: other side closed` (HTTP 200) | 18:01:23.332 | 23:31:23.332 |
| Sentry error event `31d7fac2a6b04803b6d13c40dc1f321c`: `Error: connect ECONNREFUSED 127.0.0.1:11434` (HTTP 200) | 18:01:24.339 | 23:31:24.339 |
| Attempt 1 span ends with status `error` (3 child http.client spans, all `error`), activity throws `TypeError: fetch failed` | 18:01:26.347 | 23:31:26.347 |
| Temporal ACTIVITY_TASK_STARTED attempt 2, lastFailure `fetch failed` | 18:01:27.366 | 23:31:27.366 |
| `ollama serve` restarted | 18:01:29.324 | 23:31:29.324 |
| Attempt 2 span (`temporal.attempt = 2`) ends `ok`. Wall 7978 ms, includes 2291 ms cold load. 353 input and 89 output tokens | 18:01:35.349 | 23:31:35.349 |
| Temporal ACTIVITY_TASK_COMPLETED | 18:01:35.357 | 23:31:35.357 |
| Workflow completed, all 6 processed | 18:01:52.402 | 23:31:52.402 |

Inside attempt 1, the activity made three internal calls, and each raised a captureException. Only two error events were sent. The third was an identical ECONNREFUSED and was most likely dropped by Sentry's default Dedupe integration. A client report envelope was sent afterwards.

## Code Implementation

### Prompt v2

`buildClassifyPromptV2` in `src/activities/gemma.ts`: explicit label rules, 5 few-shot examples, reason-then-label, JSON schema enum of 3 labels, temperature 0. `CLASSIFY_PROMPT=v1` switches back. Span attribute `ai.prompt_version` records which prompt was used.

### Instrumentation

From `src/activities/gemma.ts`:

```typescript
return Sentry.startSpan(
  {
    name: 'classify_notification',
    op: 'ai.inference',
    attributes: {
      'ai.model': model,
      'notification.id': notification.id,
      ...activityTags(),
    },
  },
  async (span) => {
    span?.setAttribute('ai.prompt_version', promptVersion);
    // ... Ollama call, then gen_ai.usage.* and ollama.* duration attrs
  },
);
```

Connection errors throw so Temporal retries instead of silently defaulting to `can-wait`.

## What Traces Show

Real structure seen in Sentry (span streaming envelopes, SDK 11):

```
classify_notification   op ai.inference   segment span, one per activity attempt
  └─ POST 127.0.0.1     op http.client    one per Ollama call (three on an outage attempt)
generate_digest_summary op ai.inference   segment span
  └─ POST 127.0.0.1     op http.client
```

- There is no workflow level parent span yet. All activities run by one worker process share a single trace id, so one trace holds every workflow that worker ran. A follow up is to start each activity in a trace keyed to the Temporal workflow id, or to propagate trace headers through a Temporal interceptor.

**Without a DSN**: tracing calls are no ops and the app works the same.

## How to See Live Traces

1. Export `SENTRY_DSN` in the shell (do not commit it)
2. Start Temporal and Ollama, then `pnpm dev:worker`
3. Run `OLLAMA_MODEL=gemma4:e4b pnpm live-run` to process the fixtures through real inference
4. Open Explore, then Traces in Sentry and filter on `span.op:ai.inference`
5. Optional: `SENTRY_LOG_TRANSPORT=1` prints each envelope's HTTP status and span ids (never the DSN)

## Cost Analysis

**Sentry Free Tier**:
- 10,000 transactions/month
- 50,000 errors/month
- Full AI monitoring included
- **Cost**: $0

Running Snooze Desk once per day with 10 notifications:
- ~10 transactions/day = ~300/month
- Well within free tier limits

## Why Sentry Matters

1. **Visibility**: Immediately see which step is slow (eval_duration on gemma4:e4b)
2. **Debugging**: Traces show JSON parse errors, retry attempts, attribute values
3. **Production Ready**: Error tracking + performance monitoring in one tool
4. **Free**: AI monitoring is included in Sentry's free tier

## Honest Assessment

**What we measured live** (**measured Oct 22, 2026 on a CPU-only Linux box**):
- ✅ Real traces accepted by Sentry (54 of 54 envelopes returned HTTP 200)
- ✅ Per span timings and token counts for gemma3:1b and gemma4:e4b
- ✅ A real failure path: Ollama outage, span error, Temporal activity retry, recovery
- ✅ A quality finding from the traces: gemma3:1b cannot tell spam from real work

**Not covered yet**:
- ❌ GitHub API spans (the run used fixtures because no GitHub token was available)
- ❌ A workflow level parent span tying all activities of one workflow into its own trace
- ❌ GPU numbers

**Recommendation**: Use gemma4:e4b with prompt v2 for classification. On CPU it costs about 50 s per notification, so a GPU or Apple Silicon is still the path to an interactive experience.
