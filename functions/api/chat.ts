// Cloudflare Pages Function for AI Chat API
// Automatically deployed as /api/chat

interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  MAX_TOKENS?: string;
  BASE_DOMAIN?: string;
  DOMAIN_PRICE?: string;
}

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

const SYSTEM_PROMPT = (env: Env) => `You are an AI assistant for a domain registration and management system called AINIC.

Your capabilities:
- Help users check domain availability
- Guide users through domain registration
- Assist with DNS record management (A, AAAA, CNAME, TXT)
- Handle domain status inquiries
- Process appeals for suspended domains
- Handle abuse reports

Important guidelines:
- Be professional but friendly
- Provide clear, actionable guidance
- When users want to perform actions (register, add DNS, etc.), explain what will happen
- Keep responses concise and well-structured

Base domain: ${env.BASE_DOMAIN || 'py.kg'}
Payment system: LinuxDO Credit
Price per domain: ${env.DOMAIN_PRICE || '10'} credits`;

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { message, conversationHistory = [] }: ChatRequest = await context.request.json();

    // Status check
    if (message === '__status_check__') {
      if (context.env.ANTHROPIC_API_KEY) {
        return Response.json({
          mode: 'production',
          model: context.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
        });
      } else {
        return Response.json({ mode: 'demo' });
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

    // Production mode - call Anthropic API
    const apiKey = context.env.ANTHROPIC_API_KEY;
    const model = context.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const baseURL = context.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const maxTokens = parseInt(context.env.MAX_TOKENS || '4096');

    // Build message history
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call Anthropic API
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
        messages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const assistantMessage = data.content?.[0]?.text || 'Sorry, I could not process that request.';

    return Response.json({
      response: assistantMessage,
      mode: 'production',
      model
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
      return `I've checked the domain "${domainMatch[0]}".\n\n✅ This domain is available for registration!\n\nWould you like to register it? The cost is 10 LinuxDO Credits.\n\n💡 Demo mode: Set ANTHROPIC_API_KEY for AI-powered responses.`;
    }
    return 'Please tell me which domain you\'d like to check. For example: "Is example.py.kg available?"';
  }

  // Register domain
  if (lowerMsg.includes('register') || lowerMsg.includes('buy')) {
    return 'To register a domain, I\'ll need a few details:\n\n1. Domain name (e.g., yourname.py.kg)\n2. Initial DNS records (optional)\n\nFor example: "Register mysite.py.kg pointing to 1.2.3.4"\n\n💡 Demo mode: In production, this would create a payment order.';
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
    return 'I\'m your AI domain management assistant! Here\'s what I can do:\n\n🔍 **Check Availability**\n"Is example.py.kg available?"\n\n📝 **Register Domains**\n"Register mysite.py.kg"\n\n⚙️ **Manage DNS**\n"Add A record for @ pointing to 1.2.3.4"\n\n🔧 **Domain Management**\n"Show my domains"\n"What\'s the status of my domain?"\n\n📢 **Appeals & Reports**\n"Appeal suspension for my domain"\n"Report abuse for spam.py.kg"\n\nJust describe what you want in natural language!\n\n💡 Demo mode: Set ANTHROPIC_API_KEY for real AI conversations.';
  }

  // Status check
  if (lowerMsg.includes('status') || lowerMsg.includes('my domain')) {
    return '📊 Your Domain Status:\n\nDomain: demo.py.kg\nStatus: ✅ Active\nDNS Mode: Direct management\nRecords: 3 records configured\nRegistered: 2024-01-01\n\nNeed to make changes? Just tell me what you\'d like to do!';
  }

  // Default
  return 'I\'m here to help with domain management! Try asking:\n\n• "Is [domain] available?"\n• "Register [domain]"\n• "Add DNS record"\n• "Check my domain status"\n• "Help"\n\nWhat would you like to do?\n\n💡 Demo mode: Set ANTHROPIC_API_KEY for real AI conversations.';
}
