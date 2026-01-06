# AINIC Agent - AI-First Domain Management

An experimental AI-first approach to domain management. No dashboards, no forms - just pure conversational AI.

## What Makes This Different

This is **NOT** a traditional web application. There are no admin panels, no forms, no dashboards. Everything happens through natural conversation with AI agents:

- **Users**: Chat with AI to register domains, manage DNS, check status
- **Admins**: AI agents autonomously handle reviews, appeals, and reports
- **System**: Fully conversational, no traditional UI elements

## Quick Start

### Option 1: Demo Mode (No API Key Required)

Perfect for testing the interface without any setup:

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` - the system will use mock responses!

### Option 2: Production Mode (With Real AI)

For full AI-powered conversations:

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Edit .env.local and add your API key:
# ANTHROPIC_API_KEY=sk-ant-xxxxx

# Run development server
npm run dev
```

Get your API key from: https://console.anthropic.com/

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

### Dual Mode Operation

**Demo Mode** (no API key)
- Uses pattern matching for responses
- Perfect for testing UI/UX
- No API costs
- Limited conversation ability

**Production Mode** (with API key)
- Real AI-powered conversations
- Context-aware responses
- Natural language understanding
- Full conversational capabilities

## Tech Stack

- **Next.js 15** - App Router, React Server Components
- **React 19** - Latest React features
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Anthropic Claude 3.5 Sonnet** - AI capabilities
- **PostgreSQL (Neon)** - Database
- **Drizzle ORM** - Type-safe database access

## Environment Variables

All configuration is done through environment variables in `.env.local`:

### AI Configuration

```env
# Required for production mode (optional for demo)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Choose AI model (optional, defaults to claude-3-5-sonnet-20241022)
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Available models:
#   - claude-3-5-sonnet-20241022  (Recommended: balanced)
#   - claude-opus-4-20250514      (Most capable, higher cost)
#   - claude-3-haiku-20240307     (Fastest, lowest cost)

# Custom API endpoint (optional - for proxies)
# ANTHROPIC_BASE_URL=https://your-proxy.com/v1

# Max tokens per response (optional, default: 4096)
MAX_TOKENS=4096
```

### Database Configuration

```env
# PostgreSQL connection (Neon, Supabase, etc.)
DATABASE_URL=postgresql://user:password@host/database
```

### LinuxDO Integration

```env
# OAuth authentication
LINUXDO_CLIENT_ID=your_client_id
LINUXDO_CLIENT_SECRET=your_client_secret

# Credit payment system
CREDIT_PID=your_credit_pid
CREDIT_KEY=your_credit_key
```

### Domain & DNS Configuration

```env
# Base domain for subdomains
BASE_DOMAIN=py.kg

# Domain registration price (LinuxDO Credits)
DOMAIN_PRICE=10

# Cloudflare DNS API
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id
```

See `.env.example` for the complete configuration template.

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
