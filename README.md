# AINIC - AI-First Domain Management

An experimental AI-first approach to domain management on Cloudflare Pages. No dashboards, no forms - just pure conversational AI.

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

Visit `http://localhost:8788` - the system will use mock responses!

### Option 2: Production Mode (With Real AI)

For full AI-powered conversations:

```bash
# Install dependencies
npm install

# Run development server with environment variables
npm run dev

# Or use .dev.vars for local development:
# Create .dev.vars file with:
# ANTHROPIC_API_KEY=sk-ant-xxxxx
```

Get your API key from: https://console.anthropic.com/

## Deployment to Cloudflare Pages

### Method 1: Git Integration (Recommended)

1. Push your code to GitHub
2. Go to Cloudflare Dashboard > Pages
3. Click "Create a project" > "Connect to Git"
4. Select your repository
5. Configure build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `public`
6. Add environment variables in Settings:
   - `ANTHROPIC_API_KEY` (required for AI)
   - `ANTHROPIC_MODEL` (optional, default: claude-3-5-sonnet-20241022)
   - Other configs as needed
7. Deploy!

### Method 2: Direct Deploy

```bash
# First time setup
npm install
npx wrangler login

# Deploy
npm run deploy

# Or deploy to production
npm run deploy:production
```

### Setting Environment Variables

After deployment, configure secrets in Cloudflare Dashboard:

```
Pages > Your Project > Settings > Environment variables

Required:
- ANTHROPIC_API_KEY (your API key)

Optional:
- ANTHROPIC_MODEL (default: claude-3-5-sonnet-20241022)
- ANTHROPIC_BASE_URL (for custom endpoints/proxies)
- MAX_TOKENS (default: 4096)
- BASE_DOMAIN (default: py.kg)
- DOMAIN_PRICE (default: 10)
- DATABASE_URL (PostgreSQL connection)
- LINUXDO_CLIENT_ID
- LINUXDO_CLIENT_SECRET
- CREDIT_PID
- CREDIT_KEY
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ZONE_ID
```

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

- **Cloudflare Pages** - Static hosting + serverless functions
- **Pages Functions** - API endpoints (TypeScript)
- **Vanilla JS** - Lightweight frontend (no framework)
- **Anthropic Claude 3.5 Sonnet** - AI capabilities
- **PostgreSQL (Neon)** - Database (optional, for future features)

## Project Structure

```
ainic/
├── public/              # Static frontend
│   ├── index.html       # Chat interface
│   ├── style.css        # Styling
│   └── app.js           # Frontend logic
│
├── functions/           # Pages Functions (API)
│   └── api/
│       └── chat.ts      # AI chat endpoint
│
├── wrangler.toml        # Cloudflare configuration
├── tsconfig.json        # TypeScript config
└── package.json
```

## API Endpoint

### POST /api/chat

Chat with the AI assistant.

**Request:**
```json
{
  "message": "Is example.py.kg available?",
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Response (Production Mode):**
```json
{
  "response": "I've checked the domain...",
  "mode": "production",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Response (Demo Mode):**
```json
{
  "response": "I've checked the domain... (Demo mode)",
  "mode": "demo"
}
```

## Cost Estimation (Cloudflare Pages)

### Free Plan
- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ 500 builds/month
- ✅ 100,000 Functions requests/day

**Perfect for up to ~3,000 daily active users!**

### Paid Plan ($5/month起)
- ✅ 10M Functions requests/month (included)
- ✅ $0.50 per additional million requests
- ✅ No bandwidth limits

**For 1000+ users: ~$5-8/month total**

## Local Development

```bash
# Install dependencies
npm install

# Create .dev.vars for local secrets (optional)
echo 'ANTHROPIC_API_KEY=sk-ant-xxxxx' > .dev.vars

# Start development server
npm run dev

# Visit http://localhost:8788
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
