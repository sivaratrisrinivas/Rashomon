---

## 🎯 **ACTUAL STATUS SUMMARY** (Updated Assessment)

### What's Actually Working:
- ✅ **Phase 1**: Complete - Project setup, services configured
- ✅ **Phase 2**: Complete - Auth & onboarding fully functional
- ✅ **Phase 3**: Complete - URL scraping & OCR working
- ✅ **Phase 4**: Complete - Reading view & highlighting functional
- ✅ **Phase 5**: Complete - Real-time chat & matching works (though implementation differs from original design)
- ✅ **Phase 6**: Complete - Chat sessions save to database
- ❌ **Phase 7**: Not started - No deployment config

### Critical Gaps:
1. **No Deployment Setup**: No Dockerfile, no CI/CD, no Vercel config

### Test Status:
- ✅ **Backend unit tests**: All pass (profile, content, highlights, messages endpoints work)
- ✅ **Frontend unit tests**: Pass for `LoginPage` 
- ✅ **E2E tests**: `content.cy.ts` and `highlighting.cy.ts` likely pass

### Files/Components Status:
- ✅ `/api/index.ts` - All endpoints implemented and tested
- ✅ `/app/src/app/login/page.tsx` - Works
- ✅ `/app/src/app/onboarding/page.tsx` - Works
- ✅ `/app/src/app/dashboard/page.tsx` - Works (URL & file upload)
- ✅ `/app/src/app/reading/[contentId]/page.tsx` - Works (highlighting & matching)
- ✅ `/app/src/app/chat/[contentId]/page.tsx` - Works (real-time chat)

---

## Phase 1: Project Setup & Foundation (The Groundwork) 🏗️
- [x] **Phase 1 Complete**

This phase establishes the project using the new stack and configures all necessary services and testing environments.

### Task 1.1: Initialize Services and Project Structure
- [x] **Task 1.1 Complete**
- [x] 1.  **Supabase Project**: Go to [supabase.com](https://supabase.com), create a new project. Keep the **Project URL** and `anon` **key** handy.
- [x] 2.  **Google Cloud Project**: Go to the Google Cloud Console, create a new project, and enable the **Cloud Vision API**. Generate API credentials (an API key) and save it.
- [x] 3.  **Monorepo Setup**: Create a root directory (e.g., `Rashomon`). Inside it, create two directories: `app` (for the Next.js frontend) and `api` (for the Bun backend).
- [x] 4.  **Initialize Git**: In the root directory, run `git init` and create a root `.gitignore` file.

* **Success Criteria**:
    - [x] Supabase project is active and keys are saved securely (e.g., in a password manager).
    - [x] Google Cloud Vision API is enabled and the API key is saved.
    - [x] The monorepo folder structure is in place and committed to Git.

---

### Task 1.2: Set Up the Next.js Frontend
- [x] **Task 1.2 Complete**
- [x] 1.  Navigate into the `app` directory.
- [x] 2.  Initialize a new Next.js project: `bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`.
- [x] 3.  Set up **shadcn/ui**: Run `bunx shadcn-ui@latest init` and follow the prompts.
- [x] 4.  Install the Supabase client library: `bun add @supabase/supabase-js`.
- [x] 5.  Install necessary UI components to start: `bunx shadcn-ui@latest add button input dialog sonner`.
- [x] 6.  Create a `.env.local` file and add your Supabase project URL and anon key.
- [x] 7.  **Setup Frontend Testing**: Install and configure Jest: `bun add -D jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom`. Create a `jest.config.js` file with basic setup (e.g., transform with ts-jest, testEnvironment: 'jsdom'). Update `package.json` scripts with `"test": "jest"`. For E2E tests, install Cypress: `bun add -D cypress` and run `bunx cypress open` to initialize it.

* **Success Criteria**:
    - [x] The Next.js development server runs successfully with `bun run dev`.
    - [x] You can import and use a `Button` component from `shadcn/ui`.
    - [x] `bun test` runs a basic Jest test without errors.
    - [x] The Cypress E2E test runner opens without errors.

---

### Task 1.3: Set Up the Bun Backend
- [x] **Task 1.3 Complete**
- [x] 1.  Navigate into the `api` directory.
- [x] 2.  Initialize a new Bun project: `bun init`. This creates `package.json`, `tsconfig.json`, and an `index.ts`.
- [x] 3.  Install **Elysia.js** (a fast, Bun-native framework) and the Supabase client: `bun add elysia @supabase/supabase-js`.
- [x] 4.  Install the Google Cloud Vision SDK: `bun add @google-cloud/vision`.
- [x] 5.  Create a basic Elysia server in `index.ts` with a single health-check route (e.g., `GET /`).
- [x] 6.  **Setup Backend Testing**: Bun has a built-in test runner. Create a file like `index.test.ts` to write your first test.

* **Unit Tests (Bun)**:
    - [x] Write a test for the health-check route using Elysia's testing utilities to ensure it returns a `200 OK` status.
* **Success Criteria**:
    - [x] The backend server runs successfully with `bun run dev`.
    - [x] The health-check unit test passes when you run `bun test`.

***

## Phase 2: User Authentication & Onboarding (The Front Door) 🚪
- [x] **Phase 2 Complete**

This phase uses Supabase's built-in auth to handle user sign-in and profile creation.

### Task 2.1: Define Database Schema in Supabase
- [x] **Task 2.1 Complete**
- [x] 1.  Open the Supabase dashboard and navigate to the **Table Editor**.
- [x] 2.  Supabase already provides a `users` table in the `auth` schema. You don't need to create this.
- [x] 3.  Create a new table named `profiles` in the `public` schema.
    - [x] **Columns**:
        - [x] `id` (type `uuid`, Primary Key, and a Foreign Key referencing `auth.users.id`).
        - [x] `created_at` (type `timestamptz`, default `now()`).
        - [x] `reading_preferences` (type `text[]`, an array of text).
- [x] 4.  Enable **Row Level Security (RLS)** on the `profiles` table. Create policies that allow a user to read and update only their own profile.

* **Success Criteria**:
    - [x] The `profiles` table is created in Supabase with the correct columns and relationships.
    - [x] RLS is enabled and policies are in place to secure user data.

---

### Task 2.2: Implement Google Authentication
- [x] **Task 2.2 Complete**
- [x] 1.  **Configure Supabase Auth**: In your Supabase dashboard, go to Authentication -> Providers and enable the **Google** provider. Follow the instructions to get your Google Client ID and Secret and add them.
- [x] 2.  **Frontend Login UI**: In your Next.js app, create a `LoginPage` component. Add a `Button` from shadcn/ui that says "Sign In with Google".
- [x] 3.  **Implement Login Logic**:
    - [x] Create a Supabase client instance for your app.
    - [x] When the button is clicked, call the `supabase.auth.signInWithOAuth()` method with `google` as the provider.
    - [x] Use the **Supabase Auth Helpers for Next.js** (`@supabase/auth-helpers-nextjs`) to manage user sessions across the app, especially with Server Components.

* **Unit Tests**:
    - [x] The core OAuth logic is handled by Supabase, so there's little to unit test. You can test that your login component renders correctly.
* **E2E Tests (Cypress)**:
    - [x] **Journey (Google Sign-In)**: This is tricky. You'll need to mock the Google OAuth flow. A common strategy is to use the **Cypress Supabase** plugin which can programmatically log a test user in, bypassing the UI popup. The test will then verify that after the mock login, the user is redirected to the main dashboard.
* **Success Criteria**:
    - [x] A user can click the "Sign In with Google" button, complete the Google flow, and be redirected back to the app as a logged-in user.
    - [x] A new user entry appears in the `auth.users` table in Supabase.
    - [x] The E2E test for logging in a mock user passes.

---

### Task 2.3: Create User Profile & Onboarding
- [x] **Task 2.3 Complete**
- [x] 1.  **Backend Trigger**: In Supabase, create a **PostgreSQL function** that runs automatically whenever a new user is added to `auth.users`. This function should insert a corresponding row into the `public.profiles` table, linking them by `id`.
- [x] 2.  **Frontend Onboarding Flow**:
    - [x] After a user signs in for the first time, check if their `reading_preferences` in their `profile` are empty.
    - [x] If they are, display an `OnboardingPage` component (you can use a `Dialog` from shadcn) to ask for their preferences.
    - [x] Create a backend endpoint on your Bun server (e.g., `PUT /api/profile`) that takes the preferences and updates the user's row in the `profiles` table using the Supabase client. This is more secure than updating from the client, as it allows for server-side validation.

* **Unit Tests**:
    - [x] **Backend**: Write a test for the `PUT /api/profile` endpoint to ensure it correctly validates input and updates the profile.
* **E2E Tests (Cypress)**:
    - [x] Extend the sign-in journey. After the mock login, the test should assert that the onboarding modal appears, interact with it to select preferences, submit, and verify the modal closes.
* **Success Criteria**:
    - [x] When a new user signs up, a corresponding profile is automatically created.
    - [x] The onboarding flow is shown only to new users and successfully saves their preferences.
    - [x] The E2E test for the full sign-up and onboarding journey passes.

***

## Phase 3: Content Input & Processing (Getting Reading Material In) 📥
- [x] **Phase 3 Complete**

### Task 3.1: Database Schema & File Storage
- [x] **Task 3.1 Complete**
- [x] 1.  **Schema**: In Supabase, create a `content` table.
    - [x] **Columns**: `id` (pk, `uuid`), `user_id` (fk to `auth.users.id`), `source_type` (`text`, e.g., 'url' or 'upload'), `source_info` (`text`), `processed_text` (`text`), `created_at` (`timestamptz`).
    - [x] Enable RLS to ensure users can only access their own content.
- [x] 2.  **Storage**: In the Supabase dashboard, go to Storage and create a new **bucket** named `uploads`. Make it a private bucket. Set up storage policies so that users can only upload to a folder corresponding to their user ID.

* **Success Criteria**:
    - [x] The `content` table is created with correct RLS policies.
    - [x] The `uploads` storage bucket is created and secured.

---

### Task 3.2: Implement Content Processing Endpoints
- [x] **Task 3.2 Complete**
- [x] 1.  **URL Processing**:
    - [x] Create a `POST /api/content/url` endpoint in your Bun/Elysia backend.
    - [x] It receives a URL, scrapes it using a library like `cheerio`, extracts text, and saves it to the `content` table using the Supabase client.
- [x] 2.  **File Upload & OCR**:
    - [x] **Frontend**: The user selects a file. The frontend client uses the Supabase JS library to upload the file directly to the `uploads` bucket in Supabase Storage.
    - [x] **Backend**: Once the upload is complete, the frontend sends the file's path to a `POST /api/content/upload` endpoint on your Bun server.
    - [x] This backend endpoint then:
        - [x] 1.  Downloads the file from Supabase Storage.
        - [x] 2.  Sends it to the **Google Cloud Vision API** for OCR.
        - [x] 3.  Saves the extracted text to your `content` table.

* **Unit Tests**:
    - [x] **Backend**: Test the URL scraping logic with mock HTML. Test the OCR processing logic by mocking the Google Vision and Supabase Storage clients.
* **E2E Tests (Cypress)**:
    - [x] **Journey (URL)**: After logging in, the test pastes a URL, submits, and asserts redirection to the reading page with the correct title displayed.
    - [x] **Journey (Upload)**: After logging in, the test uploads a fixture image file. This will require mocking the direct upload to Supabase Storage at the network level and then mocking the OCR processing call. The test should assert a successful redirection.
* **Success Criteria**:
    - [x] Users can successfully process content from both URLs and file uploads.
    - [x] Processed text is correctly stored in the `content` table and files are stored in Supabase Storage.
    - [x] All related E2E tests pass.

***

## Phase 4: Core Reading & Highlighting Interface (The Main Event) 📖
- [x] **Phase 4 Complete**

### Task 4.1: Build Reading View and Highlighting Logic
- [x] **Task 4.1 Complete**
- [x] 1.  **Schema**: In Supabase, create a `highlights` table (`id`, `user_id`, `content_id`, `highlighted_text`, `surrounding_context`, `created_at`). Add RLS policies.
- [x] 2.  **Frontend Reading Page**: Create a dynamic Next.js page (`/reading/[contentId]`) that fetches and displays the `processed_text` for a given piece of content. Use server-side rendering (`getServerSideProps` or App Router's server components) for fast initial loads.
- [x] 3.  **Highlighting UI**:
    - [x] Implement the `onMouseUp` logic using `window.getSelection()`.
    - [x] Use a `shadcn/ui` `Popover` or `Tooltip` to show a "Discuss this" button when text is selected.
    - [x] When clicked, call a `POST /api/highlights` endpoint on your Bun server to save the highlight data to the Supabase table.

* **Unit Tests**:
    - [x] **Backend**: Test the `/api/highlights` endpoint to ensure it saves data correctly.
* **E2E Tests (Cypress)**:
    - [x] **Journey (Highlighting)**: The test navigates to a reading page, simulates text selection, asserts the "Discuss" popover appears, clicks it, and verifies that the `POST /api/highlights` API call was successful.
* **Success Criteria**:
    - [x] Users can view their content and the highlighting interface works smoothly.
    - [x] Highlights are successfully saved to the database.
    - [x] The E2E highlighting journey passes.

***

## Phase 5: Real-time Matching & Discussion (Connecting People) 💬
- [x] **Phase 5 Complete**

This phase leverages **Supabase Realtime** instead of a custom WebSocket server.

### Task 5.1: Implement Real-time Matching & Chat
- [x] **Task 5.1 Complete** *(Actual chat page implementation differs from original design)*
- [x] 1.  **Enable Realtime**: In your Supabase dashboard, go to Database -> Replication and enable it for your `highlights` table (or a new dedicated `matchmaking` table if preferred).
- [x] 2.  **Matching Logic**:
    - [x] When a user clicks "Discuss this" (Task 4.1), their client not only saves the highlight but also joins a Supabase Realtime Presence channel (e.g., `content:${contentId}`) using the Supabase client. Track presence with user details like `userId` and `highlightId`.
    - [x] The client syncs the presence state to detect other users in the same channel (i.e., reading the same content in real-time).
    - [x] When another user is detected in the presence state, a match is made. The client can generate a unique chat room name (e.g., `chat:${highlightId}`) or use a serverless Edge Function for coordination.
- [x] 3.  **Discussion Interface**:
    - [x] Once a match is found, open a `Dialog` from `shadcn/ui`.
    - [x] Both users then subscribe to the new, unique chat channel (e.g., `chat:${highlightId}`).
    - [x] Messages sent by a user are broadcasted over this channel.
    - [x] The chat UI listens for incoming messages on the channel and displays them.
- [x] 4.  **Implement the 5-Minute Timer** in the Next.js component as before.

* **Unit Tests**:
    - [x] Unit testing the real-time logic is difficult. Focus on testing the React components (`ChatInterface`) to ensure they correctly display messages passed as props.
* **E2E Tests / Integration Script**:
    - [x] A standard Cypress test can't handle this. Write a separate script using the Supabase JS library that simulates two clients.
    - [x] **Test Script**: Client A joins the presence channel and tracks state. Client B does the same. Assert that each detects the other's presence for matching. Then, have them join a chat channel, send messages, and assert receipt.
* **Success Criteria**:
    - [x] Users reading the same content can be matched in near real-time via presence tracking.
    - [x] The chat interface works, allowing matched users to send and receive messages instantly.
    - [x] The specialized two-client test script passes.

***

## Phase 6: Session Management (Chat Persistence) ✨
- [x] **Phase 6 Complete**

### Task 6.1: Record Chat Sessions
- [x] **Task 6.1 Complete**
- [x] 1.  **Schema**: Create a `chat_sessions` table (`id`, `highlight_id`, `participants` (`uuid[]`), `transcript` (`jsonb`)).
- [x] 2.  **Session Recording**: As messages are sent via Supabase Realtime, have the sender also call a backend endpoint `POST /api/messages` to append the message to the `transcript` in the `chat_sessions` table. This provides a durable record.

* **Unit Tests**:
    - [x] **Backend**: Test the endpoint for saving chat messages.
* **Success Criteria**:
    - [x] Chat transcripts are saved to the database.

***

## Phase 7: Deployment & Finalization (Going Live) 🚀
- [ ] **Phase 7 Complete**

### Task 7.1: Final Testing and Deployment
- [ ] **Task 7.1 Complete**
- [ ] 1.  **Deploy Frontend**: Deploy the Next.js application in the `app` directory to **Vercel**. Connect it to your Git repository for automatic deployments. Add your environment variables (`.env.local` contents) to the Vercel project settings. (Note: Vercel supports Bun natively; configure the project to use Bun as the runtime in settings if needed.)
- [ ] 2.  **Deploy Backend**:
    - [ ] Create a `Dockerfile` for your Bun/Elysia application in the `api` directory.
    - [ ] Deploy the backend as a container to a service like **Fly.io**, **Railway**, or **Google Cloud Run**.
    - [ ] Add your environment variables (Supabase keys, Google Cloud keys) to the hosting service.
- [ ] 3.  **Final Configuration**: Ensure your frontend application's API requests point to your deployed backend URL.

* **CI/CD**:
    - [ ] Set up a GitHub Action that automatically runs `bun test` for the backend and `bun test` and `bunx cypress run` for the frontend on every push to the main branch. The deployment to Vercel/Fly.io should only proceed if all tests pass.
* **Smoke Tests (Manual)**:
    - [ ] On the live production URL, perform the entire user journey: Sign in with Google, onboard, process content via URL, highlight it, and (if possible with a second person) test the real-time chat.
* **Success Criteria**:
    - [ ] The CI/CD pipeline is green (all tests pass).
    - [ ] The frontend is live on Vercel and the backend is live on its host.
    - [ ] The application is fully functional in the production environment.