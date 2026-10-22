// Starts one live run of the notification workflow on the demo fixtures and
// auto-approves the resulting drafts so the workflow completes (nothing is posted
// to GitHub because no token is given).
import { getTemporalClient, startWorkflow } from '../src/lib/temporal-client';
import { DEMO_NOTIFICATIONS } from '../test/__fixtures__/demo-notifications';

async function main() {
  const model = process.env.OLLAMA_MODEL || 'gemma4:e4b';
  const digestModel = process.env.DIGEST_MODEL || 'gemma3:1b';
  const maxItems = process.env.MAX_ITEMS ? Number(process.env.MAX_ITEMS) : undefined;
  const t0 = Date.now();
  const { workflowId } = await startWorkflow({
    ollamaModel: model,
    digestModel,
    liveFixtures: true,
    maxItems,
  });
  console.log(JSON.stringify({
    event: 'started',
    workflowId,
    model,
    digestModel,
    maxItems,
    at: new Date(t0).toISOString(),
  }));
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);
  const timer = setInterval(async () => {
    for (const n of DEMO_NOTIFICATIONS) {
      try {
        await handle.signal('approve', `draft-${n.id}`);
      } catch {
        /* finished */
      }
    }
  }, 15000);
  const result = await handle.result();
  clearInterval(timer);
  console.log(JSON.stringify({
    event: 'completed',
    workflowId,
    wall_ms: Date.now() - t0,
    at: new Date().toISOString(),
    result,
  }));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
