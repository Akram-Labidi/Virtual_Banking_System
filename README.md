# AuraBank — Virtual Banking System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/NestJS-10-ED2945?logo=nestjs&logoColor=white" alt="NestJS 10" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
</p>

A virtual banking demo built to showcase a modern banking system, including a transaction engine, double-entry ledger, concurrency controls, role-based access control (RBAC), and a polished web interface.

> **Disclaimer:** This project is intended for learning, demonstrations, and portfolio use. It is not a real banking system and must not be used to process real funds, payments, or sensitive data without professional security reviews, regulatory audits, secure secret management, and production-ready database migrations.

## Project Overview

AuraBank demonstrates a robust banking application architecture through:

- A secure NestJS API
- Double-entry accounting
- Concurrency control and idempotency
- Role-based access for different user types
- A user-focused banking interface
- A modern technology stack suitable for demonstrating full-stack engineering skills

---

## Key Features

- Customer registration and JWT authentication with token refresh
- Role management for customers, advisors, and administrators
- Checking and savings account creation
- Deposits, withdrawals, internal transfers, and balance checks
- Double-entry ledger with journal validation
- Account locking and transactional processing
- Idempotency keys to prevent duplicate operations
- Fraud alerts and SHA-256 audit logs
- Simulated virtual cards with limits and business rules
- Loan application simulations and staff approvals
- Traffic simulator restricted to authorized roles
- Swagger API documentation and a role-protected user interface

---

## Architecture

```text
React + Vite (5173)
        │ /api (Vite proxy)
        ▼
NestJS (3000) ── auth, accounts, transactions, ledger,
        │          fraud, cards, loans, audit, simulator
        ▼
PostgreSQL (5432) via TypeORM
```

The ledger records each operation within a database transaction. Affected accounts are locked in a deterministic order to prevent inconsistencies. Reusing an idempotency key for the same operation returns the original result; reusing it for a different operation is rejected.

---

## Technology Stack

### Backend

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- JWT / Passport
- Swagger
- Class-validator / Class-transformer

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

---

## Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop
- Git

---

## Quick Start (Windows / PowerShell)

### 1. Start PostgreSQL

From the project root, run:

```powershell
docker compose up -d postgres
```

### 2. Create the backend environment file

From the project root:

```powershell
Copy-Item backend\.env.example backend\.env
```

Set strong, distinct values for:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Generate a secret locally with PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Run this command twice to generate separate secrets, then add them to `backend\.env`.

### 3. Start the backend

In a PowerShell terminal:

```powershell
Set-Location backend
npm install
npm run start:dev
```

### 4. Start the frontend

In a second PowerShell terminal, from the project root:

```powershell
Set-Location frontend
npm install
npm run dev
```

### 5. Open the application

- Web app: <http://localhost:5173>
- Swagger API documentation: <http://localhost:3000/api/docs>

---

## Demo Accounts

The database schema is synchronized automatically in development. To load demo users, set `SEED_DEMO_DATA=true` before starting the backend for the first time.

Demo email addresses:

- `alice@aurabank.fr`
- `bob@aurabank.fr`
- `conseiller@aurabank.fr`
- `admin@aurabank.fr`

Shared demo password:

```text
BankSecret2026!
```

> **Important:** Disable demo seeding and change or remove these accounts before any real-world deployment.

If demo data is disabled, you can register an account from the sign-up page. Public registration is limited to customer accounts.

---

## Useful Commands

Run these commands from the project root:

| Command | Description |
|---|---|
| `npm run dev:backend` | Start the NestJS backend in watch mode |
| `npm run dev:frontend` | Start the Vite frontend |
| `npm run build` | Build both the backend and frontend |
| `npm test` | Run the backend tests |
| `npm run test:concurrency` | Run the transaction engine concurrency test |

---

## Configuration and Known Limitations

- `DB_TYPE=postgres` is the recommended configuration.
- SQLite can be used for simple local testing, but it does not provide the same row-locking guarantees.
- `SEED_DEMO_DATA` is disabled by default.
- TypeORM `synchronize` is disabled in production. TypeORM migrations must be added and run before deployment.
- Cards and card-related operations are simulations only.
- API and PostgreSQL health status is available at `/api/health`.

---

## Security Considerations

This project is an educational example and is not a substitute for a professional security review. Before considering a production deployment, review:

- JWT secret generation and rotation
- Environment variable and secret management
- RBAC permissions and authorization rules
- Logging and audit mechanisms
- Database migrations and backup strategy
- Regulatory requirements for the intended use case

---

## Contributing

Contributions are welcome. To propose an improvement:

1. Fork the repository.
2. Create a dedicated branch.
3. Implement your changes.
4. Run the tests and build locally.
5. Open a pull request with a clear description.

---

## License

This project is provided for educational and demonstration purposes. Review the applicable terms before any commercial or institutional reuse.

---

## Acknowledgments

Built to showcase a modern banking application architecture focused on transactional integrity, security, and sound business logic.
