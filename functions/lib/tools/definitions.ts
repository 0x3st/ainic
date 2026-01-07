// Anthropic Tool Definitions - AI 可调用的工具定义

export const AINIC_TOOLS = [
  {
    name: 'check_domain_availability',
    description: 'Check if a domain is available for registration. Returns availability status and suggestions if unavailable.',
    input_schema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'The domain label to check (e.g., "example" for example.py.kg). Must be lowercase, alphanumeric with hyphens only.',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'register_domain',
    description: 'Register a new domain. Creates an order and returns payment URL. User must complete payment to activate domain.',
    input_schema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'The domain label to register (e.g., "mysite")',
        },
        initialDNS: {
          type: 'array',
          description: 'Optional initial DNS records to create',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'TXT'] },
              name: { type: 'string', description: 'Record name (e.g., "@", "www")' },
              content: { type: 'string', description: 'Record content (e.g., IP address or domain)' },
            },
            required: ['type', 'name', 'content'],
          },
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'list_dns_records',
    description: 'List all DNS records for the user\'s domain',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_dns_record',
    description: 'Add a new DNS record to the user\'s domain. Supports A, AAAA, CNAME, and TXT records. Maximum 10 records per domain.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['A', 'AAAA', 'CNAME', 'TXT'],
          description: 'Record type',
        },
        name: {
          type: 'string',
          description: 'Record name (use "@" for root domain, "www" for subdomain, etc.)',
        },
        content: {
          type: 'string',
          description: 'Record content (IP address for A/AAAA, domain for CNAME, text for TXT)',
        },
        ttl: {
          type: 'number',
          description: 'Time to live in seconds (default: 3600)',
        },
        proxied: {
          type: 'boolean',
          description: 'Enable Cloudflare proxy (default: false)',
        },
      },
      required: ['type', 'name', 'content'],
    },
  },
  {
    name: 'update_dns_record',
    description: 'Update an existing DNS record',
    input_schema: {
      type: 'object',
      properties: {
        recordId: {
          type: 'number',
          description: 'The ID of the record to update',
        },
        type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'TXT'] },
        name: { type: 'string' },
        content: { type: 'string' },
        ttl: { type: 'number' },
        proxied: { type: 'boolean' },
      },
      required: ['recordId', 'type', 'name', 'content'],
    },
  },
  {
    name: 'delete_dns_record',
    description: 'Delete a DNS record',
    input_schema: {
      type: 'object',
      properties: {
        recordId: {
          type: 'number',
          description: 'The ID of the record to delete',
        },
      },
      required: ['recordId'],
    },
  },
  {
    name: 'get_my_domain_status',
    description: 'Get the status and details of the user\'s registered domain',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];
