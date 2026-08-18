# 🚀 Email Scheduler — Production-Grade Email Scheduling Platform

A production-ready email scheduling platform built with **Next.js, Express.js, TypeScript, PostgreSQL/SQLite, Redis, BullMQ, Prisma, and Nodemailer**.

The platform allows users to compose, schedule, manage, cancel, and monitor emails through a modern dashboard. It uses a distributed background-job architecture to reliably process scheduled emails while supporting **concurrency, rate limiting, retries, restart recovery, and idempotent email delivery**.

---

## ✨ Features

### 📧 Email Scheduling

* Schedule emails for a future date and time
* Send emails immediately or at a scheduled time
* View all scheduled emails
* Cancel scheduled emails
* Track email delivery status
* View sent email history

### 📦 Bulk Email Scheduling

* Upload recipients using CSV
* Parse recipient lists on the frontend
* Create multiple scheduled email jobs
* Process jobs asynchronously using BullMQ workers

### ⚡ High-Throughput Background Processing

* Redis-backed BullMQ job queue
* Configurable worker concurrency
* Delayed jobs
* Automatic retries
* Job-level failure handling
* Horizontally scalable worker architecture

### 🛡️ Reliability

* Database-first scheduling
* Idempotent job processing
* Restart recovery
* Startup reconciliation
* Redis-backed delayed jobs
* Jobs are not silently lost when the application restarts

### 🚦 Rate Limiting

* Per-sender hourly rate limiting
* Configurable maximum emails per hour
* Redis atomic counters
* Automatic job rescheduling when the limit is reached
* Minimum delay between email sends

### 📊 Dashboard

* Scheduled email list
* Sent email list
* Email status indicators
* Pagination
* Loading states
* Empty states
* Email detail view
* Email cancellation

### 🔐 Authentication

* Google OAuth integration
* Demo/evaluator login
* Secure environment-based configuration

### 📨 Email Delivery

* Nodemailer SMTP integration
* Ethereal SMTP support for development/testing
* Email preview URLs
* Delivery status tracking

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      Next.js UI      │
                         │   localhost:3000     │
                         └──────────┬───────────┘
                                    │
                                    │ REST API
                                    ▼
                         ┌──────────────────────┐
                         │    Express API       │
                         │   localhost:5000     │
                         └──────────┬───────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                  ┌─────────────┐       ┌─────────────┐
                  │   Prisma    │       │    Redis    │
                  │ PostgreSQL  │       │   BullMQ     │
                  │ / SQLite    │       │    Queue     │
                  └─────────────┘       └──────┬──────┘
                                               │
                                               ▼
                                      ┌────────────────┐
                                      │  Email Worker  │
                                      │    BullMQ      │
                                      └───────┬────────┘
                                              │
                                              ▼
                                      ┌────────────────┐
                                      │   Nodemailer   │
                                      │ SMTP / Ethereal│
                                      └────────────────┘
```

---

# 🔄 How the System Works

## 1. User schedules an email

The user composes an email from the Next.js dashboard:

```text
Recipient
Subject
Message
Scheduled Date
Scheduled Time
```

The frontend sends a request to the backend:

```http
POST /api/emails/schedule
```

---

## 2. Backend validates the request

The Express API validates:

* Recipient
* Subject
* Message
* Scheduled time
* Sender information
* Required fields

Invalid requests are rejected before creating a job.

---

## 3. Database-first persistence

The email is first stored in the database.

For example:

```text
Email
--------------------------------
id
sender
recipient
subject
body
scheduledAt
status = SCHEDULED
createdAt
updatedAt
```

This is intentionally done **before inserting the job into Redis**.

The reason is reliability.

If Redis temporarily becomes unavailable, the application still has a persistent record of the scheduled email.

### Why database-first?

Without database persistence:

```text
API
 ↓
Redis
 ↓
Job
```

If Redis fails before the job is stored, the scheduled email could be lost.

With the database-first strategy:

```text
API
 ↓
Database
 ↓
Redis/BullMQ
```

The database acts as the source of truth.

---

# 4. BullMQ creates the delayed job

After the database record is created, the backend calculates how long the worker should wait.

```text
delay = scheduledTime - currentTime
```

For example:

```text
Current time:   10:00 AM
Scheduled time: 10:30 AM

Delay = 30 minutes
```

The job is then added to BullMQ:

```text
email-queue
    │
    └── email-123
          │
          ├── recipient
          ├── subject
          ├── body
          └── delay
```

BullMQ uses Redis to store delayed jobs.

---

# 5. Redis stores the delayed job

BullMQ uses Redis data structures to manage queued and delayed jobs.

Conceptually:

```text
Redis
│
├── Waiting Jobs
├── Active Jobs
├── Completed Jobs
├── Failed Jobs
└── Delayed Jobs
```

A scheduled email remains in the delayed state until its execution time arrives.

The application does **not** need:

```text
setTimeout()
```

or:

```text
node-cron
```

for every email.

This makes the system much more scalable.

---

# 6. Worker picks up the job

A BullMQ worker continuously listens for available jobs.

Example configuration:

```text
WORKER_CONCURRENCY=5
```

This means a worker can process multiple jobs concurrently.

Conceptually:

```text
              BullMQ
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
      Job 1    Job 2    Job 3
        │        │        │
        ▼        ▼        ▼
     Worker   Worker   Worker
```

Multiple worker processes can also be deployed when higher throughput is required.

---

# 7. Idempotency check

Before sending an email, the worker checks the database status.

For example:

```text
SCHEDULED
```

means the email can be processed.

If the email is already:

```text
SENT
```

the worker does not send it again.

This protects against duplicate email delivery when jobs are retried or processed again.

Conceptually:

```text
Worker receives job
        │
        ▼
Check database status
        │
   ┌────┴────┐
   │         │
SCHEDULED    SENT
   │         │
   ▼         ▼
Send email  Skip
```

---

# 8. Rate limiting

The system implements per-sender hourly rate limiting.

Example:

```text
MAX_EMAILS_PER_HOUR_PER_SENDER=10
```

The worker maintains Redis counters similar to:

```text
rate_limit:2026-08-19-10:user@example.com
```

Before sending an email, the worker increments the counter atomically.

```text
INCR rate_limit:...
```

If:

```text
count <= 10
```

the email can be sent.

If:

```text
count > 10
```

the job is not deleted.

Instead, it is rescheduled for the next available hourly window.

```text
Rate limit reached
        │
        ▼
Calculate next hour
        │
        ▼
Reschedule BullMQ job
        │
        ▼
Process later
```

This prevents accidental email loss.

---

# 9. Minimum delay between emails

The worker also supports:

```text
MIN_DELAY_BETWEEN_EMAILS_MS
```

For example:

```text
MIN_DELAY_BETWEEN_EMAILS_MS=2000
```

means the system maintains a minimum two-second delay between email dispatches.

This helps control sending speed and reduces the risk of overwhelming an SMTP provider.

---

# 10. Email delivery

After all checks pass:

```text
BullMQ Worker
      │
      ▼
Rate Limit Check
      │
      ▼
Idempotency Check
      │
      ▼
Throttle Check
      │
      ▼
Nodemailer
      │
      ▼
SMTP Server
```

For development, this project uses **Ethereal SMTP**.

Ethereal is useful because it allows developers to inspect test emails without sending them to real recipients.

---

# 11. Update email status

After successful delivery:

```text
status = SENT
```

The database stores information such as:

```text
sentAt
status
messageId
```

The dashboard then displays the email under:

```text
Sent Emails
```

If delivery fails:

```text
status = FAILED
```

The failure information can be stored for debugging and monitoring.

---

# 🔁 Restart Recovery

One of the most important reliability features is startup reconciliation.

Imagine:

```text
Database
──────────────
Email #101 → SCHEDULED
Email #102 → SCHEDULED
Email #103 → SCHEDULED
```

But Redis contains only:

```text
Redis
──────────────
Email #101
Email #103
```

Email #102 is missing from the queue.

When the backend starts, the reconciliation service checks scheduled database records against the BullMQ queue.

```text
Database
   │
   ▼
Find SCHEDULED emails
   │
   ▼
Compare with BullMQ
   │
   ├── Job exists → Nothing to do
   │
   └── Job missing → Re-enqueue
```

Therefore:

```text
Database = Source of Truth
Redis/BullMQ = Job Execution Layer
```

This architecture provides better recovery from worker or Redis interruptions.

---

# 🧩 Technology Stack

## Frontend

* Next.js 15
* React
* TypeScript
* Tailwind CSS
* Lucide Icons
* PapaParse

## Backend

* Node.js
* Express.js
* TypeScript
* REST APIs

## Database

* Prisma ORM
* SQLite for local development
* PostgreSQL for production

## Queue & Distributed Processing

* Redis
* BullMQ

## Email

* Nodemailer
* SMTP
* Ethereal Email

## Authentication

* Google OAuth 2.0

## Development

* Git
* GitHub
* npm

---

# 📁 Project Structure

```text
email-scheduler/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── controllers/
│   │   │   └── email.controller.ts
│   │   │
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   ├── queue.ts
│   │   │   ├── worker.ts
│   │   │   ├── reconciliation.ts
│   │   │   └── ethereal.ts
│   │   │
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── compose/
│   │   │   └── dashboard/
│   │   │
│   │   └── lib/
│   │
│   ├── .env.local.example
│   ├── package.json
│   └── next.config.ts
│
├── package.json
└── README.md
```

---

# ⚙️ Environment Variables

## Backend

Create:

```text
backend/.env
```

Example:

```env
PORT=5000

DATABASE_URL="file:./dev.db"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

WORKER_CONCURRENCY=5

MIN_DELAY_BETWEEN_EMAILS_MS=2000

MAX_EMAILS_PER_HOUR_PER_SENDER=10

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

ETHEREAL_USER=
ETHEREAL_PASS=
```

For production PostgreSQL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/email_scheduler"
```

---

## Frontend

Create:

```text
frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

# 🚀 Local Development

## Prerequisites

Install:

* Node.js 18+
* npm 9+
* Redis

Verify:

```bash
node -v
npm -v
redis-cli ping
```

Redis should return:

```text
PONG
```

---

# 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/email-scheduler.git
cd email-scheduler
```

---

# 2. Install backend dependencies

```bash
cd backend
npm install
```

---

# 3. Configure environment

Create:

```text
backend/.env
```

and configure the required variables.

---

# 4. Initialize Prisma

```bash
npx prisma generate
npx prisma db push
```

---

# 5. Start backend

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/health
```

---

# 6. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

---

# 7. Configure frontend

Create:

```text
frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

# 8. Start frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

# 🧪 Testing the Application

A basic test flow:

```text
1. Open dashboard
       ↓
2. Compose email
       ↓
3. Enter recipient
       ↓
4. Select future date/time
       ↓
5. Schedule email
       ↓
6. Verify Scheduled list
       ↓
7. Wait for scheduled time
       ↓
8. BullMQ worker processes job
       ↓
9. Ethereal receives email
       ↓
10. Database status becomes SENT
       ↓
11. Verify Sent list
```

---

# 🩺 Health Check

The backend exposes:

```http
GET /health
```

Example response:

```json
{
  "status": "ok"
}
```

This endpoint can be used by deployment platforms and monitoring systems to determine whether the API is healthy.

---

# 📈 Scalability

The architecture is designed so API servers and workers can be scaled independently.

For example:

```text
                   Load Balancer
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
           API #1    API #2    API #3
              │         │         │
              └─────────┼─────────┘
                        │
                        ▼
                     Redis
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
          Worker #1  Worker #2  Worker #3
```

This allows additional workers to be added as email volume increases.

---

# 🔐 Security Considerations

For production deployment:

* Never commit `.env` files
* Store secrets using environment variables or a secret manager
* Use HTTPS
* Validate all API input
* Implement authentication and authorization
* Apply API rate limiting
* Restrict CORS origins
* Secure OAuth redirect URLs
* Use PostgreSQL instead of SQLite
* Configure Redis authentication/TLS
* Sanitize HTML email content
* Add structured application logging

---

# 🛠️ Production Improvements

Potential future improvements include:

* PostgreSQL read replicas
* Redis Cluster
* Dead-letter queues
* Advanced retry policies
* Distributed tracing
* Prometheus metrics
* Grafana dashboards
* Structured logging
* Docker deployment
* Kubernetes worker scaling
* AWS ECS/EKS deployment
* Email provider failover
* Attachment storage using S3
* WebSocket-based real-time dashboard updates

---

# 📊 Core Design Decisions

| Problem                   | Solution               |
| ------------------------- | ---------------------- |
| Delayed email execution   | BullMQ delayed jobs    |
| Persistent job state      | Redis                  |
| Business data persistence | PostgreSQL/SQLite      |
| ORM                       | Prisma                 |
| Background processing     | BullMQ Workers         |
| Concurrency               | Worker concurrency     |
| Email delivery            | Nodemailer             |
| Development SMTP          | Ethereal               |
| Rate limiting             | Redis atomic counters  |
| Restart recovery          | Startup reconciliation |
| Duplicate prevention      | Idempotent worker      |
| Frontend                  | Next.js                |
| API                       | Express.js             |

---

# 🎯 Why This Architecture?

A simple implementation could use:

```text
setTimeout()
```

for every scheduled email.

However, that approach has major problems:

* Jobs disappear when the process restarts
* Difficult to scale
* Memory usage increases
* Multiple server instances create complexity
* No centralized job state
* Poor failure recovery

This project instead separates:

```text
Business Data
      +
Job Execution
```

The database stores **what needs to happen**, while Redis/BullMQ manages **when and how the work is executed**.

This separation makes the system more reliable and scalable.

---

# 👨‍💻 Author

**shaik babjan**

Software Engineer | Full-Stack Developer | AI/ML Developer

GitHub: `https://github.com/babjanshaik-png`

---

# 📄 License

This project is intended for educational and development purposes.

Add an appropriate open-source license if you plan to distribute the project publicly.
