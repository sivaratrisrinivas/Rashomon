# Rashomon

> A platform for meaningful discussions around shared reading experiences.

---

## What is Rashomon?

Rashomon is a web application that brings readers together in real-time. Imagine reading an article or document online and being able to instantly discuss specific passages with other people reading the same content at that exact moment. It's like a book club, but spontaneous and digital.

The name "Rashomon" comes from Akira Kurosawa's classic film about multiple perspectives on the same event – fitting for a platform where different readers can share their interpretations of the same text.

---

## Why Does This Exist?

Reading online can feel isolating. You might stumble upon a fascinating article, encounter a thought-provoking paragraph, and wish you could discuss it with someone right then and there. Traditional commenting systems are asynchronous – you leave a comment and hope someone responds hours or days later.

**Rashomon solves this by:**
- **Matching you with other readers** who are reading the same content at the same time
- **Letting you highlight specific text** to discuss, so conversations stay focused
- **Creating ephemeral chat rooms** that last just long enough for a meaningful exchange
- **Making serendipitous connections** between people who share reading interests

It's designed for those "aha!" moments when you want to share a reaction immediately, not days later.

---

## How Does It Work?

### The User Journey

1. **Sign In with Google**: Quick authentication, no passwords to remember.

2. **Tell Us Your Interests**: When you first join, select your reading preferences (fiction, science, history, etc.) to help us understand what you enjoy.

3. **Add Content**: You can bring content into Rashomon in two ways:
   - **Paste a URL**: We'll extract the text from any web article
   - **Upload a file**: We'll use OCR (optical character recognition) to pull text from images or documents

4. **Read**: View your content in a clean, distraction-free reading interface.

5. **Discuss**: Highlight any text passage to reveal the "Discuss this" button, which instantly connects you with other readers focused on the same section.

6. **Connect**: Wrap up the 5-minute conversation and revisit the reading view later to replay past chats directly from highlighted passages.

---

## What We've Built So Far

Rashomon is being developed in phases. Here's what's complete:

### ✅ Phase 1: Foundation (Complete)
- Set up the basic project structure
- Configured all necessary services (database, storage, APIs)
- Created testing frameworks to ensure quality

### ✅ Phase 2: Authentication & Onboarding (Complete)
- Google sign-in integration
- New user onboarding flow
- Reading preferences collection
- User profile management

### ✅ Phase 3: Content Processing (Complete)
- URL scraping: Extract text from any web page
- File upload with OCR: Pull text from images and PDFs
- Content storage and management
- Reading interface for viewing processed content

### ✅ Phase 4: Highlighting Interface (Complete)
- Text selection and highlighting with precise position capture
- Real-time matching with other readers
- Intelligent paragraph-level matching

### ✅ Phase 5: Real-Time Discussion (Complete)
- Supabase Realtime presence tracking
- Live chat with matched readers
- 5-minute timed discussion sessions
- Broadcast messaging system
- Chat transcripts reused for Perspective Replay

### ✅ Phase 6: Session Management (Complete)
- Chat transcript recording
- Session persistence in database powering Perspective Replay

### 📋 Coming Next
- **Phase 7**: Deployment and launch to production

---

## The Technology

We built Rashomon with modern, efficient tools. Here's what powers it (in plain English):

### Frontend (What You See)
- **Next.js**: A framework for building fast, modern websites
- **React**: A library for building interactive user interfaces
- **Tailwind CSS**: A styling system that makes the app look clean and professional
- **shadcn/ui**: Pre-built components for buttons, forms, and dialogs

### Backend (The Server)
- **Bun**: A fast JavaScript runtime (like the engine that runs our server code)
- **Elysia.js**: A lightweight framework for building APIs
- **Supabase**: Handles our database, user authentication, and file storage
- **Google Cloud Vision**: Performs OCR to extract text from images

### How Data Flows

```
User pastes URL
    ↓
Frontend sends URL to our server
    ↓
Server fetches the webpage
    ↓
Server extracts the text
    ↓
Server saves text to database
    ↓
User sees content in reading view
```

For file uploads, it's similar but includes an OCR step where Google's AI reads text from the image.

---

## Getting Started

### Prerequisites

You'll need these installed on your computer:
- **Bun** (version 1.0+) - for running the backend
- **Node.js** (version 20+) - for the frontend
- A **Supabase account** - for database and authentication
- A **Google Cloud account** - for OCR functionality

### Environment Setup

1. **Clone this repository**
   ```bash
   git clone https://github.com/sivaratrisrinivas/Rashomon.git
   cd Rashomon
   ```

2. **Set up the frontend** (in the `app/` directory)
   ```bash
   cd app
   bun install
   ```
   
   Create a file called `.env.local` and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Set up the backend** (in the `api/` directory)
   ```bash
   cd ../api
   bun install
   ```
   
   Create a file called `.env` and add:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   GOOGLE_CLOUD_VISION_API_KEY=your_google_vision_api_key
   ```

4. **Set up your database**
   - Go to your Supabase dashboard
   - Create these tables:
     - `profiles` (for user preferences)
     - `content` (for saved articles and documents)
   - Create a storage bucket called `uploads`
   - Enable Row Level Security policies

### Running the App

**Start the backend:**
```bash
cd api
bun run dev
```
The API will run on `http://localhost:3001`

**Start the frontend:**
```bash
cd app
bun run dev
```
The website will open at `http://localhost:3000`

### Running Tests

**Backend tests:**
```bash
cd api
bun test
```

**Frontend tests:**
```bash
cd app
bun test                    # Unit tests
bunx cypress open          # End-to-end tests
```

---

## Project Structure

```
Rashomon/
├── app/                    # Frontend Next.js application
│   ├── src/
│   │   ├── app/           # Pages and routes
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # Helper functions and utilities
│   ├── cypress/           # End-to-end tests
│   └── package.json
│
├── api/                    # Backend Bun server
│   ├── index.ts           # Main server file with all endpoints
│   ├── tests/             # Backend unit tests
│   └── package.json
│
├── tasklist.md            # Detailed development roadmap
└── README.md              # You are here!
```

---

## Key Features Explained

### URL Scraping
When you paste a web address, we fetch that page's HTML, parse it, and extract just the text content. This gives you a clean reading experience without ads or distractions.

### OCR (Optical Character Recognition)
Upload a screenshot, photo of a page, or PDF, and Google's Vision API reads the text like a human would. It's surprisingly accurate, even with handwriting or unusual fonts.

### Real-Time Matching
Using Supabase's real-time features, we detect when multiple people are reading the same content simultaneously. When you highlight specific text, we capture the exact character range so you only connect with readers focused on overlapping passages. Sessions are later replayable from the reading view.

### Ephemeral Chats
Conversations last 5 minutes by default – long enough to exchange ideas but short enough to stay focused. This prevents endless threads and encourages meaningful, in-the-moment discussion. When the timer ends, the transcript is captured so future readers can replay the dialogue from the reading view.

---

## Development Philosophy

### Why These Technologies?

- **Bun over Node.js**: It's faster and has a better developer experience
- **Next.js**: Excellent for building both the UI and API routes in one framework
- **Supabase**: Open-source, fast, and handles auth/database/storage in one service
- **Server-side rendering**: Better performance and SEO

### Testing Strategy

We test at multiple levels:
- **Unit tests**: Verify individual functions work correctly
- **Integration tests**: Ensure backend endpoints handle requests properly
- **End-to-end tests**: Simulate real user journeys through the app

### Security Considerations

- Row Level Security (RLS) ensures users can only access their own data
- Authentication is handled by Supabase (industry-standard OAuth)
- Server-side API key validation prevents unauthorized access
- User content is never shared without explicit permission

---

## Deployment

Ready to deploy Rashomon to production? Here's how to get both the frontend and backend live.

### Prerequisites

- GitHub account (for CI/CD and Render deployment)
- Vercel account (for frontend hosting)
- Render account (for backend hosting - **no credit card required**)
- Environment variables from development setup

### Deploy Backend to Render

1. **Push code to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Add deployment config"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Sign up/login with GitHub (no credit card needed)

3. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Render auto-detects `render.yaml` config

4. **Set Environment Variables**
   In the Render dashboard:
   - `SUPABASE_URL` → your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → from Supabase Settings → API
   - `GOOGLE_CLOUD_VISION_API_KEY` → from Google Cloud Console

5. **Deploy**
   - Click "Create Web Service"
   - Wait 2-3 minutes for build
   
   Your API URL will be: `https://rashomon-api.onrender.com` (or similar)

### Deploy Frontend to Vercel

1. **Push to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select "app" as the root directory

3. **Configure environment variables** in Vercel dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=https://your-api.onrender.com
   ```

4. **Deploy**
   Vercel auto-deploys on every push to main.

5. **Update Supabase redirect URLs**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your Vercel domain to Redirect URLs

### CI/CD Pipeline

GitHub Actions automatically runs tests on every push. Workflow includes:
- Backend unit tests
- Frontend unit tests  
- E2E tests with Cypress
- Deployment gate (only proceed if tests pass)

Add these secrets to your GitHub repository (Settings → Secrets):
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLOUD_VISION_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
```

### Troubleshooting

**Backend won't start on Render**
- Check logs in Render dashboard
- Verify environment variables are set correctly

**Backend is slow to respond**
- Free tier sleeps after 15min inactivity
- First request after sleep takes ~30s (cold start)

**Frontend can't reach backend**
- Confirm `NEXT_PUBLIC_API_URL` matches Render URL
- Check CORS settings in backend

**Auth redirect fails**
- Ensure Vercel domain is in Supabase redirect URLs
- Check auth callback route exists at `/auth/callback`

---

## Contributing

This is currently a learning project and personal experiment. If you're interested in contributing or have ideas, feel free to open an issue or reach out.

---

## Roadmap

**Immediate (This Week):**
- [ ] Deploy backend to production hosting
- [ ] Deploy frontend to Vercel
- [ ] Set up CI/CD pipeline
- [ ] Final production testing

**Short-term (Next Month):**
- [ ] Browser extension for one-click content addition
- [ ] Enhanced text selection and annotation
- [ ] User reading history and saved highlights

**Long-term (Future):**
- [ ] Mobile app version (iOS and Android)
- [ ] Public content library with curated collections
- [ ] Community moderation and reporting tools
- [ ] Advanced matching algorithms based on reading patterns

---

## License

This project is currently private. License details will be added when the project is ready for public release.

---

## Questions or Feedback?

This README will evolve as the project grows. If anything is unclear or you have suggestions, please open an issue in the repository.

---

**Built with curiosity and lots of coffee ☕**
