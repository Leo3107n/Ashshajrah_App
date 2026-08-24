# AshShajrah App

AshShajrah App is a multi-platform learning management system for Ash-Shajrah. The repository contains a Next.js web portal for administration, staff, teachers, students, parents, admissions, payments, and scheduling, plus an Expo mobile app that consumes the same backend APIs for role-based LMS access on mobile devices.

## Repository Structure

```text
.
├── brightspace-intelligence/   # Next.js web application and API backend
├── brightspace-mobile/         # Expo / React Native mobile application
├── package.json                # Root-level dependency metadata
└── README.md                   # Project documentation
```

## Applications

### Web Portal and Backend

Location: `brightspace-intelligence`

The web app is built with Next.js App Router and provides the main LMS experience and API layer. It includes:

- Role-based dashboards for super admin, admin, coordinator, teacher, student, and parent users.
- Authentication with NextAuth.
- Prisma-backed database access.
- Student, parent, teacher, course, subject, class, and staff management.
- Lecture scheduling, attendance, homework, notes, progress reports, and completion reports.
- Admissions, registration leads, parent interview forms, interested students, and scholarship workflows.
- Fee settings, fee vouchers, payment submission, payment proof previews, and payment verification.
- Internal events, notifications, headlines, audit logs, and reporting.
- Optional integrations for Supabase Storage, SMTP email, WhatsApp messaging, and Google Calendar / Meet.

### Mobile App

Location: `brightspace-mobile`

The mobile app is built with Expo, Expo Router, and React Native. It provides a role-aware mobile experience for LMS users, including:

- Secure login and persisted authentication.
- Role-specific navigation for students, parents, teachers, coordinators, admins, and super admins.
- Dashboards, profile views, classes, lectures, attendance, homework, notes, fees, calendar views, and notifications.
- Document/file picking and payment proof upload flows.
- Shared theme, typography, UI primitives, and loading states aligned with the Ash-Shajrah brand.

## Tech Stack

- Next.js 16
- React 19
- NextAuth 5 beta
- Prisma 6
- Tailwind CSS 4
- Supabase JavaScript client
- FullCalendar
- Expo 54
- React Native 0.81
- Expo Router
- React Native Calendars

## Prerequisites

Install the following before running the project:

- Node.js 20 or newer
- npm
- Git
- A database supported by the Prisma schema
- Expo tooling for mobile development
- Android Studio and/or Xcode if running native mobile builds locally

## Getting Started

Clone the repository:

```bash
git clone https://github.com/Paramount-Intelligence/Ashshajrah_App.git
cd Ashshajrah_App
```

Install web dependencies:

```bash
cd brightspace-intelligence
npm install
```

Install mobile dependencies:

```bash
cd ../brightspace-mobile
npm install
```

## Environment Variables

Create environment files locally. Do not commit real secrets.

### Web App

Create `brightspace-intelligence/.env.local`.

Core variables:

```env
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

Supabase storage variables:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_PUBLIC_STORAGE_URL=
SUPABASE_PAYMENT_PROOFS_BUCKET=payment_proofs
SUPABASE_ADMISSION_DOCUMENTS_BUCKET=admission_documents
```

Email variables:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_FROM_NAME=Ash-Shajrah LMS
```

WhatsApp variables:

```env
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v20.0
WHATSAPP_ADMISSION_FORM_TEMPLATE=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_NOTIFY_TO=
```

Google Calendar / Meet variables:

```env
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_CALENDAR_ID=
GOOGLE_USE_CALENDAR_ATTENDEES=false
GOOGLE_FALLBACK_MEET_LINK=
NEXT_PUBLIC_FALLBACK_MEET_LINK=
GOOGLE_WORKSPACE_ADMIN_EMAIL=
```

Scheduling and job variables:

```env
NEXT_PUBLIC_CLASS_JOIN_OPEN_BEFORE_MINUTES=10
NEXT_PUBLIC_CLASS_JOIN_OPEN_AFTER_MINUTES=0
LECTURE_PRESENT_THRESHOLD_MINUTES=20
MONTHLY_REMINDER_SECRET=
ADMISSION_FORM_REMINDER_SECRET=
PARENT_INTERVIEW_PREVIEW_PASSWORD=
```

### Mobile App

Create `brightspace-mobile/.env`.

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

When testing on a physical device, use a reachable LAN, tunnel, or deployed backend URL instead of `localhost`.

## Database Setup

The Prisma schema lives at:

```text
brightspace-intelligence/prisma/schema.prisma
```

Typical setup:

```bash
cd brightspace-intelligence
npx prisma generate
npx prisma db push
```

Seed or apply included SQL where appropriate:

```bash
npm run seed:academic
npm run seed:development-users
npm run apply:user-roles
```

Additional SQL files are available in `brightspace-intelligence/prisma/sql` for feature-specific schema updates and development setup.

## Running Locally

### Web App

```bash
cd brightspace-intelligence
npm run dev
```

Open:

```text
http://localhost:3000
```

### Mobile App

```bash
cd brightspace-mobile
npm run start
```

Then run on a simulator, emulator, physical device, or web target through Expo.

Useful shortcuts:

```bash
npm run android
npm run ios
```

## Available Scripts

### Web

Run these from `brightspace-intelligence`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the production web app. |
| `npm run start` | Start the production Next.js server after building. |
| `npm run lint` | Run ESLint. |
| `npm run apply:user-roles` | Apply the multi-role user SQL foundation. |
| `npm run verify:user-roles` | Verify the user roles foundation. |
| `npm run verify:student` | Verify student integration flows. |
| `npm run verify:parent` | Verify parent integration flows. |
| `npm run seed:academic` | Seed academic catalog data. |
| `npm run seed:development-users` | Seed development users. |

### Mobile

Run these from `brightspace-mobile`.

| Script | Purpose |
| --- | --- |
| `npm run start` | Start Expo. |
| `npm run android` | Start Expo for Android. |
| `npm run ios` | Start Expo for iOS. |

## Key Web Routes

- `/login` - user login.
- `/registration` - public registration entry.
- `/admission-form` - admission form.
- `/payment/[voucherNo]` - public payment submission.
- `/vouchers/[id]` - voucher preview.
- `/superadmin/dashboard` - super admin dashboard.
- `/admin/dashboard` - admin dashboard.
- `/coordinator/dashboard` - coordinator dashboard.
- `/teacher/dashboard` - teacher dashboard.
- `/student/dashboard` - student dashboard.
- `/parent/dashboard` - parent dashboard.

## API Overview

The backend APIs live under `brightspace-intelligence/src/app/api`. Major API groups include:

- `auth` - authentication and role options.
- `admin` - users, subjects, courses, staff, fees, payments, audit logs, headlines, and admissions workflows.
- `coordinator` - teachers, students, parents, class scheduling, lecture verification, payments, reports, and vouchers.
- `teacher` - dashboard, classes, lectures, attendance, homework, notes, profile, and students.
- `student` - dashboard, classes, lectures, attendance, homework, fees, calendar, profile, and progress reports.
- `parent` - children, dashboard, classes, lectures, attendance, homework, fees, notes, and profile.
- `public` - registration, admission forms, file upload, contact, location options, and lead workflows.
- `jobs` - scheduled reminder endpoints.
- `payment` - voucher lookup and payment submission.
- `webhooks` - WhatsApp webhook handling.

## Deployment Notes

### Web

The web app can be deployed to a Node-compatible Next.js host. Before deployment:

1. Configure production environment variables.
2. Ensure `DATABASE_URL` points to the production database.
3. Run Prisma generation and database migrations or schema synchronization as required by your deployment process.
4. Build the app with `npm run build`.
5. Start with `npm run start` or the hosting provider's Next.js runtime.

### Mobile

For mobile builds:

1. Set `EXPO_PUBLIC_API_URL` to the deployed web backend URL.
2. Confirm the Expo app identifiers in `brightspace-mobile/app.json`.
3. Build using the preferred Expo/EAS workflow.

## Development Workflow

Recommended flow:

```bash
git checkout main
git pull
git checkout -b feature/your-feature-name
```

Before opening or merging changes:

```bash
cd brightspace-intelligence
npm run lint
npm run build
```

For mobile changes, also run:

```bash
cd brightspace-mobile
npm run start
```

## Security Notes

- Never commit `.env`, `.env.local`, database credentials, service-role keys, SMTP passwords, WhatsApp tokens, or Google service credentials.
- Use service-role keys only on the server.
- Keep public mobile and browser variables limited to values that are safe to expose.
- Review payment, admission document, and storage access rules before production use.
- Rotate credentials if they have ever been exposed in logs, screenshots, or commits.

## Project Status

This repository currently contains the active Ash-Shajrah LMS web and mobile codebases. The GitHub remote is:

```text
https://github.com/Paramount-Intelligence/Ashshajrah_App.git
```
