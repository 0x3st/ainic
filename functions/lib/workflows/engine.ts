// Workflow Engine - 工作流系统核心

export interface WorkflowContext {
  [key: string]: any;
}

export interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface WorkflowStep {
  name: string;
  execute: (context: WorkflowContext) => Promise<StepResult>;
  onError?: (error: Error, context: WorkflowContext) => Promise<void>;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  context: WorkflowContext;
  executedSteps: string[];
  error?: string;
}

export class WorkflowEngine {
  async execute(
    workflow: WorkflowDefinition,
    initialContext: WorkflowContext = {}
  ): Promise<WorkflowExecutionResult> {
    const context: WorkflowContext = { ...initialContext };
    const executedSteps: string[] = [];

    try {
      for (const step of workflow.steps) {
        console.log(`[Workflow: ${workflow.name}] Executing step: ${step.name}`);

        const result = await step.execute(context);

        if (!result.success) {
          // Step failed
          if (step.onError) {
            await step.onError(new Error(result.error || 'Step failed'), context);
          }

          return {
            success: false,
            context,
            executedSteps,
            error: `Step "${step.name}" failed: ${result.error}`,
          };
        }

        // Step succeeded, update context
        if (result.data) {
          context[step.name] = result.data;
        }

        executedSteps.push(step.name);
      }

      // All steps completed successfully
      return {
        success: true,
        context,
        executedSteps,
      };
    } catch (error) {
      return {
        success: false,
        context,
        executedSteps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Helper function to create a step
export function createStep(
  name: string,
  executeFn: (context: WorkflowContext) => Promise<StepResult>,
  onErrorFn?: (error: Error, context: WorkflowContext) => Promise<void>
): WorkflowStep {
  return {
    name,
    execute: executeFn,
    onError: onErrorFn,
  };
}
