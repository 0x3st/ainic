// Check Domain Workflow - 检查域名可用性

import { WorkflowDefinition, createStep, WorkflowContext, StepResult } from './engine';

export interface CheckDomainInput {
  label: string; // e.g., "example"
  baseDomain?: string; // e.g., "py.kg"
}

export interface CheckDomainOutput {
  available: boolean;
  fqdn: string;
  existingOwner?: string;
  suggestedAlternatives?: string[];
}

export const CheckDomainWorkflow: WorkflowDefinition = {
  name: 'CheckDomain',
  description: 'Check if a domain is available for registration',

  steps: [
    // Step 1: Validate domain label
    createStep('validateLabel', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as CheckDomainInput;
      const label = input.label.toLowerCase().trim();

      // Validation rules
      if (!label || label.length < 3) {
        return {
          success: false,
          error: 'Domain label must be at least 3 characters',
        };
      }

      if (!/^[a-z0-9-]+$/.test(label)) {
        return {
          success: false,
          error: 'Domain label can only contain lowercase letters, numbers, and hyphens',
        };
      }

      if (label.startsWith('-') || label.endsWith('-')) {
        return {
          success: false,
          error: 'Domain label cannot start or end with a hyphen',
        };
      }

      return {
        success: true,
        data: { validatedLabel: label },
      };
    }),

    // Step 2: Check domain availability in database
    createStep('checkDatabase', async (ctx: WorkflowContext): Promise<StepResult> => {
      const { validatedLabel } = ctx.validateLabel;
      const baseDomain = (ctx.input as CheckDomainInput).baseDomain || 'py.kg';
      const fqdn = `${validatedLabel}.${baseDomain}`;

      try {
        // Query D1 database
        const result = await ctx.db.prepare(
          'SELECT label, owner_id, (SELECT username FROM users WHERE id = domains.owner_id) as owner_username FROM domains WHERE label = ?'
        ).bind(validatedLabel).first();

        if (result) {
          // Domain exists
          return {
            success: true,
            data: {
              available: false,
              fqdn,
              existingOwner: result.owner_username,
            },
          };
        }

        // Domain is available
        return {
          success: true,
          data: {
            available: true,
            fqdn,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 3: Generate alternatives if unavailable
    createStep('generateAlternatives', async (ctx: WorkflowContext): Promise<StepResult> => {
      const { available, fqdn } = ctx.checkDatabase;

      if (available) {
        // No need for alternatives
        return { success: true, data: null };
      }

      // Generate alternative suggestions
      const { validatedLabel } = ctx.validateLabel;
      const alternatives = [
        `${validatedLabel}1`,
        `${validatedLabel}2`,
        `my-${validatedLabel}`,
        `${validatedLabel}-site`,
      ];

      return {
        success: true,
        data: { suggestedAlternatives: alternatives },
      };
    }),
  ],
};
