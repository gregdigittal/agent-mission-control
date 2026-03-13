import { audit } from '../audit/logger.js';

export interface ApprovePayload {
  session_id: string;
  task_id: string;
  approved: boolean;
  rejection_reason?: string;
}

export async function handleApproval(payload: ApprovePayload): Promise<void> {
  const action = payload.approved ? 'approved' : 'rejected';

  await audit('task_approval', {
    sessionId: payload.session_id,
    taskId: payload.task_id,
    action,
    rejectionReason: payload.rejection_reason,
  });

  console.log(`[approve] Task ${payload.task_id} ${action}`);
}
