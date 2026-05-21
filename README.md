# InternHunter

InternHunter is a smart outreach system that finds early-stage startups, enriches their data, generates personalized cold emails via LLMs, and lets you review and send them seamlessly. 

The monorepo consists of:
- **`apps/web`**: Next.js 14 App Router frontend with TailwindCSS and React Query.
- **`apps/api`**: Node.js + Express backend powering the API and background workers (BullMQ + Redis).
- **`packages/types`**: Shared TypeScript types for API payloads and jobs.

## Getting Started in 5 Minutes

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/your-username/internhunter.git
cd internhunter

# Install dependencies from the root
npm install
```

### 2. Configure Environment Variables
You need to set up environment variables for both the API and the Web app. Example files are provided.

```bash
# Set up API environment variables
cp apps/api/.env.example apps/api/.env

# Set up Web environment variables
cp apps/web/.env.example apps/web/.env
```
Open both `.env` files and fill in your keys (especially `ANTHROPIC_API_KEY` for email generation and `NEXTAUTH_SECRET` for secure login).

### 3. Spin up Infrastructure (Database & Redis)
InternHunter relies on PostgreSQL and Redis. Use Docker Compose to start them in the background.

```bash
# Make sure Docker is running, then execute:
docker compose up -d postgres redis
```

### 4. Setup Database & Seed Initial Admin User
With the database running, push the Prisma schema and seed the initial user (so you can log into the dashboard).

```bash
# Apply schema to DB
npm run db:push --workspace=@internhunter/api

# Seed the admin user
npm run db:seed --workspace=@internhunter/api
```
*The default seeded user is `admin@internhunter.com` with the password `password123`.*

### 5. Start the Development Servers
Now you can start both the Next.js frontend, the Express API, and the background workers!

**Start the API and Workers:**
```bash
docker compose up -d api worker
# OR run them locally without docker via:
# npm run dev --workspace=@internhunter/api
# npm run dev:worker --workspace=@internhunter/api
```

**Start the Web Frontend:**
```bash
npm run dev --workspace=@internhunter/web
```

### 6. Log In
Navigate to [http://localhost:3000](http://localhost:3000) and sign in using the credentials generated in Step 4. You will be redirected to the secure `/dashboard` to manage your prospects!

---

## Deployment Configuration

InternHunter is built for zero-downtime scalable deployment.
- **API & Workers**: Deploy to [Fly.io](https://fly.io) using the provided `fly.toml` configuration and the production `apps/api/Dockerfile`.
- **Frontend**: Deploy to [Vercel](https://vercel.com) using the provided `vercel.json` configuration for optimal Next.js performance.
