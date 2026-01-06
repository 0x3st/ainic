# AINIC Agent - AI-First Domain Management

An experimental AI-first approach to domain management. No dashboards, no forms - just pure conversational AI.

## What Makes This Different

This is **NOT** a traditional web application. There are no admin panels, no forms, no dashboards. Everything happens through natural conversation with AI agents:

- **Users**: Chat with AI to register domains, manage DNS, check status
- **Admins**: AI agents autonomously handle reviews, appeals, and reports
- **System**: Fully conversational, no traditional UI elements

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Anthropic API key to .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000` and start chatting!

## Features

### User Capabilities (via Chat)
- Register domains through conversation
- Manage DNS records by describing what you want
- Check domain availability
- Appeal suspensions
- Report abuse

### Autonomous AI Admin
- Reviews domain registrations automatically
- Handles appeals with reasoning
- Processes abuse reports
- Makes decisions based on policies
- Explains decisions to users

### Demo Mode
Works without API key for testing - uses mock responses.

## Tech Stack

- **Next.js 15** - App Router, React Server Components
- **React 19** - Latest React features
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Anthropic Claude 3.5 Sonnet** - AI capabilities
- **PostgreSQL (Neon)** - Database
- **Drizzle ORM** - Type-safe database access

## Environment Variables

```env
# Required for production
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://...

# OAuth (LinuxDO)
LINUXDO_CLIENT_ID=...
LINUXDO_CLIENT_SECRET=...
```

## Deployment

Deploy to Vercel:

```bash
npm run build
# Or use Vercel CLI
vercel
```

## Philosophy

This project rejects the traditional CRUD interface paradigm. Instead:

1. **Conversational First**: All interactions happen through natural language
2. **AI Autonomy**: AI makes decisions within policy boundaries
3. **No Forms**: Natural language replaces structured forms
4. **Context-Aware**: AI maintains conversation context
5. **Transparent**: AI explains its reasoning

## License

MIT
