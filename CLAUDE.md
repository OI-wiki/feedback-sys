# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OI Wiki Feedback System is a three-part system for adding paragraph-level comment functionality to websites:
1. **Python Markdown Extension**: Parses markdown and maps HTML elements to source document offsets
2. **Cloudflare Workers Backend**: Provides data storage and OAuth authentication
3. **Frontend**: Injects comment UI components into pages

## Architecture

### Components
- **python-markdown-extension/**: Python package that adds data attributes to HTML elements linking them to source markdown positions
- **cloudflare-workers/**: TypeScript backend on Cloudflare Workers with D1 database for comment storage
- **frontend/**: TypeScript frontend library that provides comment UI and API integration

### Data Flow
1. Markdown documents are processed by the Python extension, adding `data-original-document-start` and `data-original-document-end` attributes
2. Frontend scans for these attributes and enables comment functionality per paragraph
3. Comments are stored in Cloudflare D1 database with path + offset as keys
4. GitHub OAuth for user authentication, with Telegram notifications for new comments

## Development Commands

### Python Markdown Extension
```bash
cd python-markdown-extension
rye sync          # Install dependencies
rye build         # Build package
rye run test      # Run tests
python ./test/cli.py <file.md>  # Test CLI tool
```

### Cloudflare Workers Backend
```bash
cd cloudflare-workers
yarn install      # Install dependencies
yarn dev          # Start dev server (localhost:8787)
yarn test         # Run tests
yarn deploy       # Deploy to Cloudflare
wrangler secret put <KEY>  # Set secrets
```

### Frontend
```bash
cd frontend
yarn install      # Install dependencies
yarn dev          # Start dev server (localhost:5173 with API proxy)
yarn build        # Build for production
```

## Key Configuration

### Environment Variables (Cloudflare Workers)
- `ADMINISTRATOR_SECRET`: Admin authentication secret
- `TELEGRAM_BOT_TOKEN`: Bot token for notifications
- `TELEGRAM_CHAT_ID`: Chat ID for notifications
- `GITHUB_APP_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_APP_CLIENT_SECRET`: GitHub OAuth app client secret
- `OAUTH_JWT_SECRET`: JWT signing secret
- `GITHUB_ORG_ADMINISTRATOR_TEAM`: GitHub team for admin access

### Database Schema
See `cloudflare-workers/schema.sql` for D1 database structure

### Frontend Setup
```javascript
import { setupReview } from 'oiwiki-feedback-sys-frontend'
setupReview(document.getElementById('content'), { 
  apiEndpoint: 'https://your-worker-domain.com' 
})
```

## Testing
- Backend: `yarn test` in cloudflare-workers/
- Frontend: Manual testing via `yarn dev`
- Python extension: `rye run test` or CLI testing