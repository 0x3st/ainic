// Register Domain Workflow - 域名注册工作流

import { WorkflowDefinition, createStep, WorkflowContext, StepResult } from './engine';

export interface RegisterDomainInput {
  label: string;
  userId: number;
  baseDomain?: string;
  initialDNS?: Array<{
    type: string;
    name: string;
    content: string;
  }>;
}

export interface RegisterDomainOutput {
  success: boolean;
  orderId?: number;
  orderNo?: string;
  paymentUrl?: string;
  domainId?: number;
  message: string;
}

export const RegisterDomainWorkflow: WorkflowDefinition = {
  name: 'RegisterDomain',
  description: 'Register a new domain (includes payment flow)',

  steps: [
    // Step 1: Check user quota
    createStep('checkQuota', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as RegisterDomainInput;

      try {
        // Check if user already has a domain
        const existingDomain = await ctx.db.prepare(
          'SELECT COUNT(*) as count FROM domains WHERE owner_id = ?'
        ).bind(input.userId).first();

        if (existingDomain && existingDomain.count > 0) {
          return {
            success: false,
            error: 'You already have a domain registered. Each user can only register one domain.',
          };
        }

        return { success: true, data: { quotaAvailable: true } };
      } catch (error) {
        return {
          success: false,
          error: `Failed to check quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 2: Validate domain availability (reuse check logic)
    createStep('validateAvailability', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as RegisterDomainInput;
      const label = input.label.toLowerCase().trim();

      try {
        const existing = await ctx.db.prepare(
          'SELECT id FROM domains WHERE label = ?'
        ).bind(label).first();

        if (existing) {
          return {
            success: false,
            error: `Domain ${label} is already registered`,
          };
        }

        return { success: true, data: { label } };
      } catch (error) {
        return {
          success: false,
          error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 3: Create order
    createStep('createOrder', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as RegisterDomainInput;
      const { label } = ctx.validateAvailability;
      const price = parseFloat(ctx.env.DOMAIN_PRICE || '10');

      try {
        const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const result = await ctx.db.prepare(
          'INSERT INTO orders (order_no, user_id, label, amount, status) VALUES (?, ?, ?, ?, ?)'
        ).bind(orderNo, input.userId, label, price, 'pending').run();

        return {
          success: true,
          data: {
            orderId: result.meta.last_row_id,
            orderNo,
            amount: price,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 4: Generate payment URL (LinuxDO Credit)
    createStep('generatePaymentURL', async (ctx: WorkflowContext): Promise<StepResult> => {
      const { orderNo, amount } = ctx.createOrder;
      const input = ctx.input as RegisterDomainInput;

      // TODO: Integrate with LinuxDO Credit API
      // For now, return a placeholder
      const paymentUrl = `https://credit.linux.do/pay?order=${orderNo}&amount=${amount}`;

      return {
        success: true,
        data: {
          paymentUrl,
          message: 'Order created. Please complete payment to activate domain.',
        },
      };
    }),
  ],
};

// 支付完成后的工作流（由支付回调触发）
export const CompleteRegistrationWorkflow: WorkflowDefinition = {
  name: 'CompleteRegistration',
  description: 'Complete domain registration after payment',

  steps: [
    // Step 1: Verify payment
    createStep('verifyPayment', async (ctx: WorkflowContext): Promise<StepResult> => {
      const { orderNo } = ctx.input;

      try {
        const order = await ctx.db.prepare(
          'SELECT id, user_id, label, status FROM orders WHERE order_no = ?'
        ).bind(orderNo).first();

        if (!order) {
          return { success: false, error: 'Order not found' };
        }

        if (order.status !== 'pending') {
          return { success: false, error: `Order is already ${order.status}` };
        }

        return { success: true, data: order };
      } catch (error) {
        return { success: false, error: `Database error: ${error}` };
      }
    }),

    // Step 2: Update order status
    createStep('updateOrderStatus', async (ctx: WorkflowContext): Promise<StepResult> => {
      const order = ctx.verifyPayment;

      try {
        await ctx.db.prepare(
          'UPDATE orders SET status = ?, paid_at = datetime(\'now\') WHERE id = ?'
        ).bind('paid', order.id).run();

        return { success: true, data: null };
      } catch (error) {
        return { success: false, error: `Failed to update order: ${error}` };
      }
    }),

    // Step 3: Create domain record
    createStep('createDomain', async (ctx: WorkflowContext): Promise<StepResult> => {
      const order = ctx.verifyPayment;
      const baseDomain = ctx.env.BASE_DOMAIN || 'py.kg';
      const fqdn = `${order.label}.${baseDomain}`;

      try {
        const result = await ctx.db.prepare(
          'INSERT INTO domains (label, fqdn, owner_id, status) VALUES (?, ?, ?, ?)'
        ).bind(order.label, fqdn, order.user_id, 'active').run();

        return {
          success: true,
          data: {
            domainId: result.meta.last_row_id,
            fqdn,
          },
        };
      } catch (error) {
        return { success: false, error: `Failed to create domain: ${error}` };
      }
    }),

    // Step 4: Create initial DNS records (if provided)
    createStep('createInitialDNS', async (ctx: WorkflowContext): Promise<StepResult> => {
      const { initialDNS } = ctx.input;
      const { domainId } = ctx.createDomain;

      if (!initialDNS || initialDNS.length === 0) {
        return { success: true, data: null };
      }

      try {
        for (const record of initialDNS) {
          await ctx.db.prepare(
            'INSERT INTO dns_records (domain_id, type, name, content) VALUES (?, ?, ?, ?)'
          ).bind(domainId, record.type, record.name, record.content).run();
        }

        return { success: true, data: { recordsCreated: initialDNS.length } };
      } catch (error) {
        // Non-critical error, domain is still created
        console.error('Failed to create initial DNS records:', error);
        return { success: true, data: { recordsCreated: 0 } };
      }
    }),
  ],
};
