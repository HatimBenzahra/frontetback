# Project Context for Qwen Code

## Project Overview

This is a **NestJS backend** for a Prospection CRM application. The project is organized into multiple modules, each handling specific domains of the application. Key features include user authentication via Keycloak, role-based access control, data management for commercial activities (zones, buildings, doors, teams, managers, commercials), statistics, assignment goals, prospection events, transcription history, and data exports.

The application is configured to run with HTTPS in production and HTTP in development, with CORS settings for local and production environments. It uses Prisma ORM to interact with a PostgreSQL database.

## Key Technologies

- **Framework:** NestJS (Node.js)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Keycloak integration
- **Configuration:** dotenv for environment variables
- **Validation:** class-validator
- **Testing:** Jest
- **Deployment:** Docker (Dockerfile present)

## Building and Running

1.  **Install Dependencies:**
    ```bash
    cd backend
    npm install
    ```
2.  **Set up environment variables:** Ensure the `.env` file in the `backend` directory is correctly configured, especially `DATABASE_URL`.
3.  **Database Setup:**
    Prisma is used for database management.
    - The database schema is defined in `backend/prisma/schema.prisma`.
    - Run `npx prisma db push` to synchronize your database schema.
    - Run `npx prisma generate` to generate the Prisma Client (this is also a postinstall script).
    - Run `npm run seed` to populate the database with initial data (if `prisma/seed.ts` exists).
4.  **Run the Application:**
    - Development mode (with auto-reload): `npm run start:dev`
    - Production mode: `npm run start:prod` (includes `prisma db push`)
    - Basic start: `npm run start`
5.  **Linting:** `npm run lint`
6.  **Testing:** `npm run test` (or `npm run test:e2e` for end-to-end tests)

## Development Conventions

- **Module Structure:** The application is split into feature modules (e.g., `auth`, `commercial`, `manager`, `zone`, `immeuble`, `porte`, etc.) located under `backend/src`.
- **Prisma:** Prisma is used for database interactions. Services interact with the database through `PrismaService`.
- **Authentication:** Authentication is handled by the `AuthModule`, which integrates with Keycloak. User creation, password setup/reset, and login are managed here.
- **Environment Variables:** Configuration is managed via environment variables defined in the `backend/.env` file. There's a unified IP configuration section for easy environment switching.
- **CORS:** CORS settings are explicitly configured in `main.ts` for both HTTPS and HTTP modes, allowing requests from specific local and production origins.