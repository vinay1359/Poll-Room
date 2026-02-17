# Pollbox

Real-time poll rooms with transparent anti-abuse protection. Built with Next.js, Supabase, Socket.io, and Redis.

## Features

**Core Functionality**
- Real-time vote updates via Supabase Realtime and Socket.io
- Single-choice voting with one vote per device
- Shareable polls with unique links and QR codes
- Optional poll expiration with real-time auto-close
- Vote timeline visualization showing last 6 hours
- Full persistence in PostgreSQL
- Mobile-optimized touch-friendly UI
- Dark mode with theme toggle

**Anti-Abuse Protection (6 Layers)**
1. Device fingerprinting using browser characteristics
2. Rate limiting via Redis (memory fallback)
3. Replay attack prevention with nonce validation
4. Timestamp validation for request freshness
5. Behavior score tracking (time on page + mouse movement)
6. IP-based duplicate detection with SHA-256 hashing

**Optional Features**
- Google OAuth verification placeholders (ready for implementation)
- Live viewer count via Socket.io
- Per-option vote timeline graphs

## Project Structure

```
app/
  api/
    health/route.ts              - Health check endpoint
    polls/route.ts               - Create and list polls
    polls/[pollId]/route.ts      - Get poll details
    polls/[pollId]/history/
      route.ts                   - Vote timeline (total)
      options/route.ts           - Per-option vote timeline
    votes/route.ts               - Submit votes
  components/
    Header.tsx                   - Site header with navigation
    Footer.tsx                   - Site footer
    ThemeProvider.tsx            - Theme context provider
    ThemeToggle.tsx              - Dark mode toggle
  poll/[pollId]/page.tsx         - Poll voting page
  page.tsx                       - Home page with poll creation
  layout.tsx                     - Root layout
  globals.css                    - Global styles
lib/
  deviceId.ts                    - Cookie-based device tracking
  fingerprint.ts                 - Browser fingerprinting
  hash.ts                        - SHA-256 hashing utility
  nonceTracker.ts                - Replay attack prevention
  rateLimit.ts                   - Redis-based rate limiting
  realtimeClient.ts              - Socket.io client
  realtimePublisher.ts           - Socket.io event publisher
  redisClient.ts                 - Redis connection manager
  supabaseClient.ts              - Supabase client
  supabaseServer.ts              - Supabase admin client
  trustScore.ts                  - Vote trust validation
  types.ts                       - TypeScript interfaces
realtime/
  server.ts                      - Socket.io server
supabase/migrations/
  001_init.sql                   - Initial schema
  002_counts.sql                 - Vote counts with triggers
  004_realtime.sql               - Realtime configuration
  005_poll_counts_policies.sql   - Row-level security
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
copy .env.example .env.local
```

3. Configure environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `REDIS_URL` - Redis connection URL (optional, falls back to memory)
- `NEXT_PUBLIC_REALTIME_URL` - Socket.io server URL (optional)
- `REALTIME_URL` - Socket.io server URL for server-side (optional)
- `REALTIME_PORT` - Socket.io server port (default: 4001)

4. Run database migrations in Supabase SQL editor (execute in order):
```sql
-- Execute each file in order:
supabase/migrations/001_init.sql
supabase/migrations/002_counts.sql
supabase/migrations/004_realtime.sql
supabase/migrations/005_poll_counts_policies.sql
```

5. Verify Realtime is enabled in Supabase:
- Navigate to Database → Replication
- Ensure `poll_counts` table has replication enabled

6. Start development servers:
```bash
npm run dev
```

This starts both Next.js (port 3000) and Socket.io (port 4001).

## Deployment

**Deploy Next.js app to Vercel:**

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REDIS_URL` (optional)
   - `NEXT_PUBLIC_REALTIME_URL` (optional, if deploying Socket.io server)
   - `REALTIME_URL` (optional, if deploying Socket.io server)
4. Deploy

The app works with Supabase Realtime only. Socket.io is optional for viewer count feature.

**Deploy Socket.io server to Railway (optional):**

1. Create new project in Railway
2. Add from GitHub repo
3. Set start command: `npm run start:realtime`
4. Add environment variable:
   - `REALTIME_PORT` (Railway will provide `PORT`)
5. Deploy and copy the public URL
6. Update Vercel environment variables:
   - `NEXT_PUBLIC_REALTIME_URL` = Railway URL
   - `REALTIME_URL` = Railway URL

**Alternative deployments:**
- Next.js: Netlify, Cloudflare Pages, AWS Amplify
- Socket.io: Render, Fly.io, DigitalOcean

## Architecture

**Real-time Updates:**
- Primary: Supabase Realtime (PostgreSQL LISTEN/NOTIFY)
- Optional: Socket.io for viewer count and supplementary updates
- No polling, fully event-driven

**Data Flow:**
1. User submits vote via `/api/votes`
2. Vote passes 6 security layers
3. Stored in PostgreSQL with SHA-256 hashed identifiers
4. Database trigger updates `poll_counts` table
5. Supabase Realtime broadcasts change to all connected clients
6. UI updates instantly without refresh

**Security Measures:**
- All votes require device fingerprint + IP hash
- Nonce prevents replay attacks (5-minute expiry)
- Rate limiting: max 5 votes per IP per 5 minutes
- Behavior score detects bots (time + mouse movement)
- Database row-level security with Supabase policies
- Service role key never exposed to client

## Security & Anti-Abuse Details

**How It Works (Simple Explanation):**

1. **Device Fingerprinting** - When you visit a poll, the app creates a unique ID by combining your browser type, version, screen size, timezone, and language. This helps identify if the same device tries to vote twice.

2. **Rate Limiting** - If the same IP address tries to vote more than 5 times within 5 minutes, it gets blocked for 10 minutes. This stops spam attacks.

3. **Nonce (One-Time Tokens)** - Each time you load a poll page, you get a special code that expires in 5 minutes and can only be used once. If someone tries to replay the same vote request, it gets rejected.

4. **Timestamp Validation** - Vote requests older than 5 minutes or from the future are automatically rejected. This prevents storing old requests and replaying them later.

5. **Behavior Score** - The app tracks how long you're on the page and your mouse movements. Real humans need at least 7 points (example: 4 seconds on page + 3 mouse moves = 7 points). Instant clicks with no movement get blocked.

6. **IP Hashing** - Your IP address is encrypted using SHA-256 before storing. This tracks duplicates without saving your actual IP address for privacy.

**Edge Cases We Handle:**

- ✅ Poll expires while you're voting → Returns "expired" message
- ✅ Same device votes twice → Returns "duplicate" message  
- ✅ Redis server crashes → Automatically switches to memory-based rate limiting
- ✅ Someone replays an old vote request → Rejected as replay attack
- ✅ Bot clicks too fast without moving mouse → Friendly error asking to read the poll
- ✅ Vote request with future timestamp → Rejected as invalid
- ✅ Server restarts → Rate limit data persists in Redis (lost in memory fallback)

**Known Limitations (What Could Be Improved):**

- ⚠️ Can be bypassed using different browsers or devices on the same computer
- ⚠️ Switching VPN or using proxy servers can bypass IP-based rate limits
- ⚠️ Sophisticated bots can simulate mouse movements to fake behavior score
- ⚠️ If Redis is not configured, memory fallback loses rate limit data on server restart
- ⚠️ Google OAuth verification is prepared but not fully implemented
- ⚠️ No CAPTCHA for suspicious activity (could be added as Layer 7)
- ⚠️ Browser fingerprint can be spoofed with specialized tools
- ⚠️ No email verification system (could prevent multi-account abuse)

**What Makes a Vote "Trusted":**
- New device (first time voting on this poll)
- Clean IP (not rate limited)
- Behavior score ≥ 7
- Valid nonce (not reused)
- Recent timestamp (within 5 minutes)
- No cooldown active

All votes that pass these checks get a trust score of 100 and are counted immediately.

## Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- CSS Modules
- QR Code generation

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Realtime)
- Socket.io (optional)
- Redis (optional, with memory fallback)

**Security:**
- Zod for input validation
- SHA-256 for hashing
- Browser fingerprinting
- Nonce-based replay prevention
- Rate limiting
- Row-level security

## API Endpoints

**GET /api/health**
- Health check endpoint
- Returns: `{ status: "ok" }`

**POST /api/polls**
- Create new poll
- Body: `{ question: string, options: string[], expiresAt?: string }`
- Returns: `{ pollId: string }`

**GET /api/polls**
- List recent polls (12 most recent)
- Returns: `{ polls: Array<Poll> }`

**GET /api/polls/[pollId]**
- Get poll details with current counts
- Returns: `{ poll: Poll, options: Option[], counts: Count[] }`

**GET /api/polls/[pollId]/history**
- Get vote timeline for last 6 hours
- Returns: `{ timeline: Array<{ time: string, count: number }> }`

**GET /api/polls/[pollId]/history/options**
- Get per-option vote timeline for last 6 hours
- Returns: `{ options: Option[], timeline: Array<{ time: string, counts: Record<string, number> }> }`

**POST /api/votes**
- Submit a vote
- Body: `{ pollId: string, optionId: string, fingerprint: string, behaviorScore?: number, verified?: boolean, timestamp?: number, nonce?: string }`
- Returns: `{ status: "accepted" | "duplicate" | "rejected" | "expired" }`

## Development

**Run only Next.js:**
```bash
npm run dev:next
```

**Run only Socket.io server:**
```bash
npm run dev:realtime
```

**Run both concurrently:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

**Start Socket.io in production:**
```bash
npm run start:realtime
```

## Environment Variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side)

**Optional:**
- `REDIS_URL` - Redis connection URL (format: redis://user:password@host:port)
- `NEXT_PUBLIC_REALTIME_URL` - Socket.io server URL for client
- `REALTIME_URL` - Socket.io server URL for server
- `REALTIME_PORT` - Socket.io server port (default: 4001)

## Database Schema

**polls**
- `id` (uuid, primary key)
- `question` (text)
- `created_at` (timestamp)
- `expires_at` (timestamp, nullable)

**poll_options**
- `id` (uuid, primary key)
- `poll_id` (uuid, foreign key)
- `label` (text)
- `sort_order` (integer)

**votes**
- `id` (uuid, primary key)
- `poll_id` (uuid, foreign key)
- `option_id` (uuid, foreign key)
- `ip_hash` (text) - SHA-256 hash
- `device_hash` (text) - SHA-256 hash
- `trust_score` (integer)
- `is_verified` (boolean)
- `created_at` (timestamp)

**poll_counts**
- `poll_id` (uuid, composite key)
- `option_id` (uuid, composite key)
- `vote_count` (integer)
- `updated_at` (timestamp)

Triggers automatically update `poll_counts` when votes are inserted.

## Notes

- All votes use server-side Supabase admin client for security
- Trust score validation in `lib/trustScore.ts`
- Rate limiting uses Redis when available, falls back to in-memory
- Nonces expire after 5 minutes
- Vote timestamps must be within 5 minutes
- Behavior score requires minimum 7 points (4+ seconds + 2+ mouse moves)
- Device fingerprints combine cookie ID and browser characteristics
- All sensitive data is SHA-256 hashed before storage
