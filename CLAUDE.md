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

### Database Schema (cloudflare-workers/schema.sql)
- `pages`: Stores document paths
- `offsets`: Maps document positions to page IDs
- `commenters`: User information from OAuth providers
- `comments`: Comment content with timestamps and relationships
- `metas`: Key-value storage for system metadata

## Development Commands

### Python Markdown Extension
```bash
cd python-markdown-extension
uv sync           # Install dependencies with uv
uv build          # Build package
uv run test       # Run tests (uses pytest)
python ./test/cli.py <file.md>  # Test CLI tool with sample markdown
```

### Cloudflare Workers Backend
```bash
cd cloudflare-workers
yarn install      # Install dependencies
yarn dev          # Start dev server (localhost:8787)
yarn test         # Run tests with Vitest
yarn deploy       # Deploy to Cloudflare
wrangler secret put <KEY>  # Set secrets for deployment
wrangler d1 execute comments --file=schema.sql  # Initialize database
```

### Frontend
```bash
cd frontend
yarn install      # Install dependencies
yarn dev          # Start dev server (localhost:5173 with API proxy)
yarn build        # Build for production
yarn fmt          # Format code with Prettier
```

## Testing

### Backend Testing (Cloudflare Workers)
- **Test framework**: Vitest with Cloudflare Workers testing utilities
- **Test location**: `cloudflare-workers/test/index.spec.ts`
- **Run tests**: `yarn test` from cloudflare-workers directory
- **Test setup**: Requires environment variables in `.dev.vars` for local testing

### Frontend Testing
- **Testing approach**: Manual testing via development server
- **Development server**: `yarn dev` starts Vite dev server with API proxy
- **Build verification**: `yarn build` ensures production builds work correctly

### Python Extension Testing
- **Test framework**: pytest
- **Test location**: `python-markdown-extension/test/`
- **Run tests**: `uv run test` or `python -m pytest test/`
- **CLI testing**: `python ./test/cli.py sample.md` for manual verification

## Release Process

The OI Wiki Feedback System uses GitHub Actions for automated releases. All three components are published simultaneously when a new Git tag is created.

### Automated Release Steps
1. **Update version numbers** in all three components:
   - `cloudflare-workers/package.json`
   - `frontend/package.json`
   - `python-markdown-extension/pyproject.toml`

2. **Test locally** (recommended):
   ```bash
   # Cloudflare Workers
   cd cloudflare-workers && yarn test

   # Frontend
   cd frontend && yarn build

   # Python extension
   cd python-markdown-extension && uv run test
   ```

3. **Commit version bump**:
   ```bash
   git add .
   git commit -m "chore: bump to vX.Y.Z"
   git tag vX.Y.Z
   git push origin master --tags
   ```

4. **GitHub Actions will automatically**:
   - Deploy Cloudflare Workers (triggered by tag push)
   - Publish Frontend to npm (triggered by tag push)
   - Publish Python extension to PyPI (triggered by tag push)
   - Upload build artifacts

### CI/CD Workflows
- **Deploy cloudflare-workers**: `.github/workflows/deploy-cloudflare-workers.yml`
- **Publish frontend**: `.github/workflows/publish-frontend.yml`
- **Publish python-markdown-extension**: `.github/workflows/publish-python-markdown-extension.yml`
- **Format checking**: Additional workflows for code formatting validation

All workflows trigger on tag pushes (`*`) and include both deployment and artifact upload steps.

## Key Configuration

### Environment Variables (Cloudflare Workers)
Required for development and deployment:
- `ADMINISTRATOR_SECRET`: Admin authentication secret
- `TELEGRAM_BOT_TOKEN`: Bot token for notifications
- `TELEGRAM_CHAT_ID`: Chat ID for notifications
- `GITHUB_APP_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_APP_CLIENT_SECRET`: GitHub OAuth app client secret
- `OAUTH_JWT_SECRET`: JWT signing secret
- `GITHUB_ORG_ADMINISTRATOR_TEAM`: GitHub team for admin access

### Development Setup
1. **Backend**: Create `cloudflare-workers/.dev.vars` with environment variables
2. **Frontend**: Configure API endpoint in development environment
3. **Python**: Install extension and configure Markdown processing

### Frontend Integration
```javascript
import { setupReview } from 'oiwiki-feedback-sys-frontend'
setupReview(document.getElementById('content'), {
  apiEndpoint: 'https://your-worker-domain.com'
})
```

## Development Tips

### Local Development Setup
1. **Start backend**: `cd cloudflare-workers && yarn dev`
2. **Start frontend**: `cd frontend && yarn dev` (proxies to backend)
3. **Test Python extension**: Use CLI tool or integrate with local Markdown processing

### Database Management
- **Initialize**: `wrangler d1 execute comments --file=schema.sql`
- **Local development**: Use `--local` flag for local D1 database
- **Production**: Use `--remote` flag for production database

### Debugging
- **Python extension**: Enable debug mode in extension configuration
- **Backend**: Use `wrangler dev` with console logging
- **Frontend**: Browser developer tools with Vite HMR

## Dependencies

### Package Managers
- **Python**: uv (replaces rye)
- **JavaScript**: Yarn 1.x
- **Build systems**: Hatch (Python), Vite (frontend)

### Key Libraries
- **Backend**: itty-router, Cloudflare Workers types, JWT handling
- **Frontend**: Vite, TypeScript, Iconify for icons
- **Python**: markdown library with custom extension system

This architecture enables paragraph-level commenting with proper source mapping, OAuth authentication, and real-time notifications.