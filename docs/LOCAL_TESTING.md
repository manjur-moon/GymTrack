
# GymTrack — Local Testing Checklist

## 1. Environment Setup

- Use an isolated development or disposable test database.
- Never run tests or seed scripts against production.
- Verify DATABASE_URL and DIRECT_URL before migrations.
- For local PostgreSQL, start Docker Compose and point both URLs to that database.

## 2. Database Setup

Run against the verified development/test database:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

## 3. Authentication and Demo

- Verify login and registration.
- Test the read-only demo account.
- On a fresh seeded database, verify 12 completed demo workouts.
- Confirm the demo account cannot create plans (403).
- Confirm users cannot access another user's sessions.

## 4. Workout Management — R1 to R4

- Create and activate a workout plan.
- Start a workout and log sets.
- Verify workout progress and the rest timer.
- Test offline set synchronization and conflict handling.
- Finish a workout.
- Verify the workout summary, duration and exercise breakdown.
- Confirm the completed workout appears in history.

## 5. Coach Management — R2

- Verify coach role authorization.
- Invite a client.
- Accept or decline the invitation.
- Verify only approved clients are accessible.
- Confirm revoked relationships block access.

## 6. Program Assignments — R3

- Create and publish a program template.
- Assign a published version to an approved client.
- Verify scheduled workouts appear on the client dashboard.
- Complete a scheduled workout.
- Verify its completion status updates.

## 7. Coach Analytics — R5

- Verify active client and assignment counts.
- Verify scheduled-workout adherence.
- Verify overdue-session calculations.
- Check the weekly activity chart.
- Test client adherence filters.
- Verify coaches cannot access other coaches' private client data.

## 8. Automated Verification

```bash
npm run test:run
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Run E2E tests against an isolated test database.

## Security

Never expose database credentials, API keys or authentication secrets.

Never use production for test registration, seeding or workout logging.
