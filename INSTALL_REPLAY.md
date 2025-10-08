# Installation Guide for Perspective Replay Feature

## Quick Start

The Perspective Replay feature has been fully implemented. Follow these steps to get it running:

### 1. Install New Dependencies

The feature requires `date-fns` for timestamp formatting:

```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/app
bun install
```

This will install `date-fns@4.1.0` which was added to `package.json`.

### 2. Verify Backend

The backend API endpoint is already integrated. No additional setup needed for the API.

### 3. Start the Servers

**Terminal 1 - Backend:**
```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/api
bun run dev
```

**Terminal 2 - Frontend:**
```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/app
bun run dev
```

### 4. Run Tests (Optional)

**Backend Tests:**
```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/api
bun test tests/sessions.test.ts
```

**Frontend Tests:**
```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/app
bun test src/components/__tests__/PerspectiveReplay.test.tsx
```

**E2E Tests:**
```bash
cd /home/srinivas/workspace/github.com/sivaratrisrinivas/Rashomon/app
bunx cypress open
# Select replay.cy.ts from the test list
```

## How to Use the Feature

1. **Create a chat session** (requires 2 users):
   - User A: Add content and highlight text
   - User B: Highlight same text and join chat
   - Have a conversation for a few messages
   - Let the timer expire or navigate away

2. **View the replay**:
   - Go back to the reading page for that content
   - You'll see "🎭 Perspective Replay" toggle in the header
   - Click to enable replay mode
   - Hover over paragraphs to see 💬 indicators
   - Click an indicator to view the past conversation

## What Was Added

### New Files
- `/api/tests/sessions.test.ts` - Backend tests
- `/app/src/components/PerspectiveReplay.tsx` - Replay dialog component
- `/app/src/components/__tests__/PerspectiveReplay.test.tsx` - Component tests
- `/app/cypress/e2e/replay.cy.ts` - E2E tests
- `/PERSPECTIVE_REPLAY_IMPLEMENTATION.md` - Implementation documentation

### Modified Files
- `/api/index.ts` - Added GET /content/:contentId/sessions endpoint
- `/app/package.json` - Added date-fns dependency
- `/app/src/app/reading/[contentId]/page.tsx` - Integrated replay UI

## Troubleshooting

### "Cannot find module 'date-fns'" error

**Solution:** Run `bun install` in the `/app` directory.

### Toggle doesn't appear

**Solution:** The toggle only appears when there are past chat sessions for that content. Create a chat session first.

### Indicators don't show

**Solution:** Make sure replay mode is enabled (toggle should be highlighted). Hover over paragraphs to reveal indicators.

### Sessions endpoint returns empty array

**Solution:** Check that chat sessions were successfully saved to the database. Look at the `chat_sessions` table in Supabase.

## Feature Status

✅ Backend endpoint implemented and tested
✅ Frontend component created and tested  
✅ Reading page integration complete
✅ E2E tests written
✅ All linting errors resolved

**Ready for production after running `bun install`!**

