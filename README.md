# FormAI Backend API

Backend API server for FormAI gym assistant application.

## Features

- **Image Analysis**: OpenAI-powered gym machine analysis
- **Authentication**: Better-auth integration with SQLite
- **Payments**: Stripe integration for billing
- **Rate Limiting**: 20 requests per 10 minutes per IP
- **CORS**: Configurable origins support

## API Endpoints

- `GET /health` - Health check
- `GET /analyze` - Get analysis info
- `POST /analyze` - Analyze gym machine image
- `POST /billing-portal` - Generate billing portal URL
- `ALL /autumn/*` - Autumn payment proxy

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Server
PORT=4001
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Database
TURSO_CONNECTION_URL=file:local.db
TURSO_AUTH_TOKEN=

# Stripe
STRIPE_SECRET_KEY=sk_test_your-key-here

# Better Auth
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:4001
```

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database

```bash
# Generate migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

## Deployment

This backend is designed to be deployed independently on Render or similar platforms.

1. Set the Root Directory to `server/`
2. Configure environment variables
3. Deploy with `npm start`
