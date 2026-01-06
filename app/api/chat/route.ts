import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    // Demo mode - mock responses without requiring API key
    const lowerMsg = message.toLowerCase();
    let response = '';

    // Check domain availability
    if (lowerMsg.includes('available') || lowerMsg.includes('check')) {
      const domainMatch = message.match(/[\w-]+\.[\w-]+/);
      if (domainMatch) {
        response = `I've checked the domain "${domainMatch[0]}".\n\n✅ This domain is available for registration!\n\nWould you like to register it? The cost is 10 LinuxDO Credits.`;
      } else {
        response = 'Please tell me which domain you\'d like to check. For example: "Is example.py.kg available?"';
      }
    }
    // Register domain
    else if (lowerMsg.includes('register') || lowerMsg.includes('buy')) {
      response = 'To register a domain, I\'ll need a few details:\n\n1. Domain name (e.g., yourname.py.kg)\n2. Initial DNS records (optional)\n\nFor example: "Register mysite.py.kg pointing to 1.2.3.4"\n\n💡 Demo mode: In production, this would create a payment order.';
    }
    // DNS management
    else if (lowerMsg.includes('dns') || lowerMsg.includes('record')) {
      response = 'I can help you manage DNS records!\n\nTell me what you want to do:\n• "Add A record pointing to 1.2.3.4"\n• "Add CNAME www pointing to example.com"\n• "List my DNS records"\n• "Delete the TXT record"\n\nWhat would you like to do?';
    }
    // Appeal
    else if (lowerMsg.includes('appeal') || lowerMsg.includes('suspend')) {
      response = 'I see you want to appeal a suspension.\n\nPlease tell me:\n1. Which domain was suspended?\n2. Why do you believe it should be reinstated?\n\nI\'ll review your appeal and respond within 24 hours.';
    }
    // Report abuse
    else if (lowerMsg.includes('report') || lowerMsg.includes('abuse')) {
      response = 'To report domain abuse, please provide:\n\n1. Domain name being abused\n2. Type of abuse (spam, phishing, malware, etc.)\n3. Evidence or description\n\nExample: "Report spam.py.kg for sending spam emails"';
    }
    // Help/General
    else if (lowerMsg.includes('help')) {
      response = 'I\'m your AI domain management assistant! Here\'s what I can do:\n\n🔍 **Check Availability**\n"Is example.py.kg available?"\n\n📝 **Register Domains**\n"Register mysite.py.kg"\n\n⚙️ **Manage DNS**\n"Add A record for @ pointing to 1.2.3.4"\n\n🔧 **Domain Management**\n"Show my domains"\n"What\'s the status of my domain?"\n\n📢 **Appeals & Reports**\n"Appeal suspension for my domain"\n"Report abuse for spam.py.kg"\n\nJust describe what you want in natural language!';
    }
    // Status check
    else if (lowerMsg.includes('status') || lowerMsg.includes('my domain')) {
      response = '📊 Your Domain Status:\n\nDomain: demo.py.kg\nStatus: ✅ Active\nDNS Mode: Direct management\nRecords: 3 records configured\nRegistered: 2024-01-01\n\nNeed to make changes? Just tell me what you\'d like to do!';
    }
    // Default
    else {
      response = 'I\'m here to help with domain management! Try asking:\n\n• "Is [domain] available?"\n• "Register [domain]"\n• "Add DNS record"\n• "Check my domain status"\n• "Help"\n\nWhat would you like to do?';
    }

    return NextResponse.json({ response });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
