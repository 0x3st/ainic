// Workflow Registry - 工作流注册中心

import { WorkflowDefinition, WorkflowEngine, WorkflowContext } from './engine';
import { CheckDomainWorkflow } from './check-domain';
import { RegisterDomainWorkflow, CompleteRegistrationWorkflow } from './register-domain';
import { ManageDNSWorkflow } from './manage-dns';

// Workflow registry
const workflows = new Map<string, WorkflowDefinition>();

// Register all workflows
workflows.set('CheckDomain', CheckDomainWorkflow);
workflows.set('RegisterDomain', RegisterDomainWorkflow);
workflows.set('CompleteRegistration', CompleteRegistrationWorkflow);
workflows.set('ManageDNS', ManageDNSWorkflow);

/**
 * Execute a workflow by name
 */
export async function executeWorkflow(
  workflowName: string,
  context: WorkflowContext
): Promise<any> {
  const workflow = workflows.get(workflowName);

  if (!workflow) {
    throw new Error(`Workflow "${workflowName}" not found`);
  }

  const engine = new WorkflowEngine();
  const result = await engine.execute(workflow, context);

  // Log execution to database (if DB is available)
  if (context.db && context.userId) {
    try {
      await context.db.prepare(
        'INSERT INTO workflow_executions (workflow_name, user_id, input, output, status, error, steps, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
      ).bind(
        workflowName,
        context.userId,
        JSON.stringify(context.input),
        JSON.stringify(result.context),
        result.success ? 'completed' : 'failed',
        result.error || null,
        JSON.stringify(result.executedSteps)
      ).run();
    } catch (error) {
      console.error('Failed to log workflow execution:', error);
    }
  }

  return result;
}

/**
 * Get all available workflows
 */
export function getAvailableWorkflows(): string[] {
  return Array.from(workflows.keys());
}

/**
 * Get workflow definition
 */
export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return workflows.get(name);
}

// Export all workflows
export {
  CheckDomainWorkflow,
  RegisterDomainWorkflow,
  CompleteRegistrationWorkflow,
  ManageDNSWorkflow,
};
