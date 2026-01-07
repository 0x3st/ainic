// Cloudflare Pages Function for AI Chat API with Tool Use
// Automatically deployed as /api/chat

import { AINIC_TOOLS } from '../lib/tools/definitions';
import { executeTool } from '../lib/tools/executor';

interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  MAX_TOKENS?: string;
  BASE_DOMAIN?: string;
  DOMAIN_PRICE?: string;
  DB?: D1Database;
}

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: string; content: any }>;
}

const SYSTEM_PROMPT = (env: Env) => `You are an AI assistant for AINIC, a domain registration and management system.

You have access to tools that let you actually perform operations, not just provide information.

Your capabilities:
- Check domain availability using real database queries
- Register domains (creates orders with payment links)
- Manage DNS records (add, update, delete, list)
- Query domain status from the database

Important guidelines:
- Use tools to perform actual operations when users ask
- Be professional but friendly
- Provide clear explanations of what you're doing
- When tools return errors, explain them clearly to users
- After using tools, summarize the results in a user-friendly way

Base domain: ${env.BASE_DOMAIN || 'py.kg'}
Payment system: LinuxDO Credit
Price per domain: ${env.DOMAIN_PRICE || '10'} credits

Note: Users need to authenticate for operations like registration and DNS management.`;

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  data?: any;
}): Promise<Response> {
  try {
    const { message, conversationHistory = [] }: ChatRequest = await context.request.json();

    // Status check
    if (message === '__status_check__') {
      const hasDB = !!context.env.DB;
      if (context.env.ANTHROPIC_API_KEY) {
        return Response.json({
          mode: 'production',
          model: context.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
          hasDatabase: hasDB,
          toolsAvailable: hasDB,
        });
      } else {
        return Response.json({
          mode: 'demo',
          hasDatabase: false,
          toolsAvailable: false,
        });
      }
    }

    // Check if API key is configured
    if (!context.env.ANTHROPIC_API_KEY) {
      // Demo mode - fallback to mock responses
      return Response.json({
        response: getDemoResponse(message),
        mode: 'demo'
      });
    }

    // Check if DB is available
    if (!context.env.DB) {
      return Response.json({
        response: 'Database not configured. Tools are unavailable. Please configure D1 database binding.',
        mode: 'production',
        model: context.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      });
    }

    // Production mode with Tool Use
    const apiKey = context.env.ANTHROPIC_API_KEY;
    const model = context.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const baseURL = context.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const maxTokens = parseInt(context.env.MAX_TOKENS || '4096');

    // Build message history
    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    // Tool use loop - AI may call tools multiple times
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 5; // Prevent infinite loops

    while (continueLoop && loopCount < maxLoops) {
      loopCount++;

      // Call Anthropic API with tools
      const response = await fetch(`${baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT(context.env),
          messages,
          tools: AINIC_TOOLS,
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Anthropic API error:', error);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as any;

      // Check stop reason
      if (data.stop_reason === 'end_turn') {
        // AI finished, return final response
        const textContent = data.content.find((c: any) => c.type === 'text');
        return Response.json({
          response: textContent?.text || 'No response generated',
          mode: 'production',
          model,
        });
      }

      if (data.stop_reason === 'tool_use') {
        // AI wants to use tools
        const toolResults = [];

        for (const block of data.content) {
          if (block.type === 'tool_use') {
            console.log(`[Tool Call] ${block.name}:`, block.input);

            // Execute the tool
            const toolResult = await executeTool(
              block.name,
              block.input,
              {
                db: context.env.DB!,
                env: context.env,
                userId: context.data?.userId, // TODO: Get from session
              }
            );

            console.log(`[Tool Result] ${block.name}:`, toolResult);

            // Format tool result for Anthropic API
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(toolResult),
            });
          }
        }

        // Add assistant's message (with tool use) to history
        messages.push({
          role: 'assistant',
          content: data.content,
        });

        // Add tool results to history
        messages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue loop - let AI process tool results
        continue;
      }

      // Unexpected stop reason
      continueLoop = false;
      const textContent = data.content.find((c: any) => c.type === 'text');
      return Response.json({
        response: textContent?.text || 'Unexpected response from AI',
        mode: 'production',
        model,
      });
    }

    // Max loops reached
    return Response.json({
      response: 'I apologize, but I encountered an issue processing your request. Please try again with a simpler query.',
      mode: 'production',
      model,
    });

  } catch (error) {
    console.error('Chat API error:', error);

    return Response.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check your ANTHROPIC_API_KEY configuration'
      },
      { status: 500 }
    );
  }
}

// Demo mode responses (fallback when no API key)
function getDemoResponse(message: string): string {
  const lowerMsg = message.toLowerCase();

  // Check domain availability
  if (lowerMsg.includes('available') || lowerMsg.includes('check')) {
    const domainMatch = message.match(/[\w-]+\.[\w-]+/);
    if (domainMatch) {
      return `I've checked the domain "${domainMatch[0]}".\n\n✅ This domain is available for registration!\n\nWould you like to register it? The cost is 10 LinuxDO Credits.\n\n💡 Demo mode: Set ANTHROPIC_API_KEY for AI-powered responses with real tools.`;
    }
    return 'Please tell me which domain you\'d like to check. For example: "Is example.py.kg available?"';
  }

  // Register domain
  if (lowerMsg.includes('register') || lowerMsg.includes('buy')) {
    return 'To register a domain, I\'ll need a few details:\n\n1. Domain name (e.g., yourname.py.kg)\n2. Initial DNS records (optional)\n\nFor example: "Register mysite.py.kg pointing to 1.2.3.4"\n\n💡 Demo mode: In production, this would create a real payment order using workflows.';
  }

  // DNS management
  if (lowerMsg.includes('dns') || lowerMsg.includes('record')) {
    return 'I can help you manage DNS records!\n\nTell me what you want to do:\n• "Add A record pointing to 1.2.3.4"\n• "Add CNAME www pointing to example.com"\n• "List my DNS records"\n• "Delete the TXT record"\n\nWhat would you like to do?';
  }

  // Appeal
  if (lowerMsg.includes('appeal') || lowerMsg.includes('suspend')) {
    return 'I see you want to appeal a suspension.\n\nPlease tell me:\n1. Which domain was suspended?\n2. Why do you believe it should be reinstated?\n\nI\'ll review your appeal and respond within 24 hours.';
  }

  // Report abuse
  if (lowerMsg.includes('report') || lowerMsg.includes('abuse')) {
    return 'To report domain abuse, please provide:\n\n1. Domain name being abused\n2. Type of abuse (spam, phishing, malware, etc.)\n3. Evidence or description\n\nExample: "Report spam.py.kg for sending spam emails"';
  }

  // Help
  if (lowerMsg.includes('help')) {
    return 'I\'m your AI domain management assistant! Here\'s what I can do:\n\n🔍 **Check Availability**\n"Is example.py.kg available?"\n\n📝 **Register Domains**\n"Register mysite.py.kg"\n\n⚙️ **Manage DNS**\n"Add A record for @ pointing to 1.2.3.4"\n\n🔧 **Domain Management**\n"Show my domains"\n"What\'s the status of my domain?"\n\n📢 **Appeals & Reports**\n"Appeal suspension for my domain"\n"Report abuse for spam.py.kg"\n\nJust describe what you want in natural language!\n\n💡 Demo mode: Set ANTHROPIC_API_KEY in .env.local for real AI with workflow execution.';
  }

  // Status check
  if (lowerMsg.includes('status') || lowerMsg.includes('my domain')) {
    return '📊 Your Domain Status:\n\nDomain: demo.py.kg\nStatus: ✅ Active\nDNS Mode: Direct management\nRecords: 3 records configured\nRegistered: 2024-01-01\n\nNeed to make changes? Just tell me what you\'d like to do!';
  }

  // Default
  return 'I\'m here to help with domain management! Try asking:\n\n• "Is [domain] available?"\n• "Register [domain]"\n• "Add DNS record"\n• "Check my domain status"\n• "Help"\n\nWhat would you like to do?\n\n💡 Demo mode: Set ANTHROPIC_API_KEY for real AI conversations with tool execution.';
}
