# RoutinCafe POS Backend 🚀

Welcome to the **RoutinCafe POS** backend repository! This application is built with a strictly typed, incredibly robust, and flat architecture optimized for enterprise scalability and ease of development.

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js (v5)
- **Database:** MariaDB / MySQL
- **ORM:** Prisma
- **Validation:** Zod
- **Documentation:** Swagger (OpenAPI 3.0)

---

## 📖 Mandatory Reading for Developers

Before you write your first line of code, you must read the internal documentation detailing the architecture standards:

1. [**Developer Guide**](./DEVELOPER_GUIDE.md) - Explains how the 4-layer architecture functions and enforces clean anti-spaghetti code constraints.
2. [**AI Instructions**](./AI_INSTRUCTIONS.md) - Exact naming patterns and automated constraints configured for any AI coding assistants working in this repository.

---

## ⚙️ Getting Started (Local Setup)

### Prerequisites

Make sure you have installed the following on your machine:

- Node.js (v18+)
- MariaDB or MySQL running locally
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AEU-THESIS/backend.git
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Duplicate the example environment file:

```bash
cp .env.example .env
```

Open the `.env` file and verify the database connection credentials match your local MariaDB/MySQL instance.
_(Note: We rely on `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Prisma dynamically builds the connection URL avoiding string redundancy!)_

### 4. Setup Database

Run the following commands to synchronize your native database with the Prisma schema state:

```bash
# Push schema to the database (alternatively use npm run db:migrate for migrations tracking)
npx prisma db push

# Generate the typed Prisma Client for your code
npx prisma generate
```

### 5. Run the Server

Launch the development server. It implements hot-reloading so changes manifest instantly:

```bash
npm run dev
```

The application should print:

```text
🚀 Server running on http://localhost:3000
🚀 Swagger UI running on http://localhost:3000/api-docs
```

---

## 🧩 API Documentation (Swagger)

This project features self-updating Swagger documentation. After starting the server run `npm run dev`, simply open your browser and navigate to:
👉 `http://localhost:3000/api-docs`

To document your own endpoints, write standard YAML `@openapi` blocks directly inside files located under the `src/docs/` folder!

---

## 🗄️ Database Management (Migrations & Seeding)

This project uses Prisma to manage the database state and schema changes.

### Migrations

If you modify `prisma/schema.prisma` (for example, adding a new model or column), you must generate a migration script to update the database safely without losing existing data.

**To create and apply a new migration:**

```bash
npx prisma migrate dev --name <describe_your_change>
```

_(Example: `npx prisma migrate dev --name add_order_status_column`)_

Alternatively, if you are just prototyping locally and want to ruthlessly sync the schema without generating migration history files, use:

```bash
npx prisma db push
```

### Seeding

Seeding is useful for populating your database with required initial data (such as default Roles, root Admin Users, or dummy data for testing).

**To execute the seed script:**

```bash
npm run db:seed
```

_(This command runs `prisma/seed.ts`. Ensure you define your logic there first!)_

### Resetting the Database

If you ever run into massive migration conflicts, database corruption, or just want to wipe the slate entirely clean and start over:

```bash
npx prisma migrate reset
```

⚠️ _Warning: This drops the entire database, rebuilds it from the existing migration files, and then **automatically triggers the seed script** so you have a fresh environment._

---

## 👨‍💻 Workflow Overview

If you need to add a new domain feature (e.g. `Orders`), remember the flow:

1. Define the Zod Schema in `src/validations/orderValidation.ts`.
2. Write Database/Business logic in `src/services/orderService.ts`.
3. Wrap it all cleanly using the Controller Core in `src/controllers/orderController.ts`.
4. Expose the route and secure it under `src/routes/orderRoutes.ts`.
5. Combine `orderRoutes` up into `src/routes/index.ts`.
