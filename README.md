# Notion ↔ Google Keep Sync

A bidirectional sync system between Notion and Google Keep, built for Vercel with near real-time updates.

## Architecture

- **Notion → Keep**: Event-driven via webhooks (typically < 1 minute latency)
- **Keep → Notion**: Polling-based via Vercel Cron Jobs (every 2 minutes by default)
- **Conflict Prevention**: Last-writer-wins with 30-second cooldown to prevent loops
- **State Storage**: Vercel KV for sync mappings and timestamps

## Features

✅ Real-time webhook handling for Notion changes  
✅ Scheduled polling of Google Keep notes  
✅ Automatic conflict resolution with cooldown periods  
✅ Bidirectional mapping between Notion pages and Keep notes  
✅ Manual sync and status endpoints for debugging  
✅ Support for both plain text and checklist notes

## Prerequisites

1. **Vercel Account** with KV storage enabled
2. **Notion Integration** with:
   - Integration token
   - Database ID
   - Webhook configured
3. **Google Cloud Project** with:
   - Keep API enabled
   - OAuth 2.0 credentials
   - Refresh token obtained

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd misc-api
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:

```env
# Notion
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Keep OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Internal API Key (generate a random string)
INTERNAL_API_KEY=your-random-secret-key
```

### 3. Set Up Notion

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy the integration token to `NOTION_API_KEY`
3. Share your database with the integration
4. Copy the database ID from the URL to `NOTION_DATABASE_ID`
5. Set up a webhook at https://www.notion.so/my-integrations/internal/webhooks
   - Point it to `https://your-domain.vercel.app/api/notion/webhook`
   - Copy the webhook secret to `NOTION_WEBHOOK_SECRET`

### 4. Set Up Google Keep OAuth

Google Keep API requires OAuth 2.0. Here's how to get your refresh token:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the "Google Keep API"
3. Create OAuth 2.0 credentials (Desktop app type)
4. Use the OAuth Playground or a script to obtain a refresh token with scope:
   ```
   https://www.googleapis.com/auth/keep
   ```

**Note**: Google Keep API is designed for enterprise/workspace accounts. Personal accounts may have limited access.

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 6. Set Up Vercel KV

1. In your Vercel project dashboard, go to Storage
2. Create a new KV database
3. Link it to your project (environment variables are auto-added)

### 7. Configure Environment Variables in Vercel

Add all your environment variables from `.env` to your Vercel project:

```bash
vercel env add NOTION_API_KEY
vercel env add NOTION_DATABASE_ID
vercel env add NOTION_WEBHOOK_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN
vercel env add INTERNAL_API_KEY
```

## API Endpoints

### POST /api/notion/webhook

Handles Notion webhook events. Automatically called by Notion when pages change.

**Headers**:

- `notion-signature`: Webhook signature (automatically provided by Notion)

**Response**:

```json
{
  "success": true,
  "message": "Synced to Keep",
  "keepNoteName": "notes/abc123"
}
```

### GET /api/cron/poll-keep

Polls Google Keep for changes. Automatically invoked every 2 minutes by Vercel Cron.

**Headers**:

- `Authorization`: `Bearer <vercel-cron-secret>` (automatically provided by Vercel)

**Response**:

```json
{
  "success": true,
  "message": "Keep polling complete",
  "details": {
    "processed": 10,
    "created": 2,
    "updated": 3,
    "skipped": 5,
    "errors": []
  }
}
```

### POST /api/internal/sync

Manual sync and debugging endpoint.

**Headers**:

- `x-api-key`: Your `INTERNAL_API_KEY`

**Actions**:

1. **Get Status**

   ```json
   { "action": "status" }
   ```

2. **List Mappings**

   ```json
   { "action": "list-mappings" }
   ```

3. **Force Sync** (placeholder)
   ```json
   {
     "action": "force-sync",
     "direction": "both"
   }
   ```

## Data Mapping

### Notion → Keep

- **Title property** → Keep note title
- **Rich text properties** → Keep note body (as `key: value` pairs)
- **Checkbox properties** → Keep checklist items

### Keep → Notion

- **Note title** → Notion title property
- **Plain text body** → Parsed as `key: value` into rich text properties
- **Checklist items** → Checkbox properties

### Custom Mapping

Modify [lib/mapping.ts](lib/mapping.ts) to customize how fields are translated between Notion and Keep.

## Conflict Handling

The system uses a **last-writer-wins** strategy with a 30-second cooldown:

1. Each sync operation records:

   - Origin (`notion` or `keep`)
   - Timestamp
   - Last synced times for both sides

2. Before syncing, the system checks:

   - Has the data changed since last sync?
   - Is this within 30 seconds of our own write?

3. If yes to both, the change is skipped (prevents infinite loops)

## Local Development

```bash
# Install dependencies
npm install

# Run locally (starts Vercel dev server)
npm run dev
```

For webhook testing:

- Use [ngrok](https://ngrok.com/) or [localtunnel](https://localtunnel.github.io/www/) to expose your local server
- Update your Notion webhook URL to point to the tunnel

For cron job testing:

- Call `http://localhost:3000/api/cron/poll-keep` manually
- Or use the internal sync endpoint

## Troubleshooting

### Webhook not receiving events

- Verify webhook URL in Notion settings
- Check webhook secret matches environment variable
- Look at Vercel function logs for errors

### Keep API errors

- Ensure Keep API is enabled in Google Cloud Console
- Verify refresh token is valid
- Check that your Google account has Keep API access

### Sync loops

- Check cooldown is working (30 seconds default)
- Review sync state in KV storage
- Use `/api/internal/sync` with action `list-mappings` to debug

### Notes not syncing

- Verify database ID is correct
- Check Notion integration has access to the database
- Review Vercel function logs for specific errors

## Customization

### Change Poll Frequency

Edit [vercel.json](vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-keep",
      "schedule": "*/1 * * * *" // Every 1 minute
    }
  ]
}
```

### Adjust Cooldown Period

Modify the cooldown check in your sync endpoints:

```typescript
shouldSkipDueToCooldown(existingMapping, "notion", 60000); // 60 seconds
```

### Custom Field Mapping

Edit [lib/mapping.ts](lib/mapping.ts) to change how Notion properties map to Keep note fields.

## File Structure

```
misc-api/
├── api/
│   ├── notion/
│   │   └── webhook.ts          # Notion webhook handler
│   ├── cron/
│   │   └── poll-keep.ts        # Keep polling cron job
│   └── internal/
│       └── sync.ts             # Manual sync endpoint
├── lib/
│   ├── types.ts                # TypeScript type definitions
│   ├── sync-state.ts           # Vercel KV state management
│   ├── keep-client.ts          # Google Keep API client
│   ├── notion-client.ts        # Notion API client
│   └── mapping.ts              # Data mapping utilities
├── package.json
├── tsconfig.json
├── vercel.json                 # Vercel config with cron job
└── README.md
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for seamless note syncing between Notion and Google Keep.
