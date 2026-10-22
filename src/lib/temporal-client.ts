import { Connection, Client } from '@temporalio/client';
import { notificationProcessorWorkflow, snoozeSignal, approveSignal } from '../workflows/notification-processor';
import type { WorkflowInput } from '../types';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });
    client = new Client({ connection });
  }
  return client;
}

export async function startWorkflow(input: WorkflowInput) {
  const temporalClient = await getTemporalClient();
  const workflowId = `notification-processor-${Date.now()}`;
  
  const handle = await temporalClient.workflow.start(notificationProcessorWorkflow, {
    taskQueue: 'snooze-desk',
    workflowId,
    args: [input],
  });

  return {
    workflowId,
    runId: handle.firstExecutionRunId,
  };
}

export async function snoozeNotification(workflowId: string, draftId: string, hours: number) {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);
  await handle.signal(snoozeSignal, draftId, hours);
}

export async function approveNotification(workflowId: string, draftId: string) {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);
  await handle.signal(approveSignal, draftId);
}

export async function getWorkflowResult(workflowId: string) {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);
  return await handle.result();
}

export async function getWorkflowStatus(workflowId: string) {
  try {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.workflow.getHandle(workflowId);
    const description = await handle.describe();
    return {
      status: description.status.name,
      runId: description.runId,
    };
  } catch (error) {
    return { status: 'NOT_FOUND', error };
  }
}
