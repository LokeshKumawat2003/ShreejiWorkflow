# Backend

Express 5 API using MongoDB/Mongoose.

## Structure

- `src/config`: database setup
- `src/controllers`: authentication and Organization request handlers
- `src/middleware`: JWT authentication and role authorization
- `src/models`: User schema
- `src/routes`: authentication, dashboard, and Organization routes
- `src/services`: authentication and Organization business logic
- `src/utils`: shared HTTP errors, user serialization, and validation
- `test`: API and authorization tests

## Run

Copy `.env.example` to `.env`, set a private `JWT_SECRET`, and start MongoDB. Then run `npm run dev` from this directory. MongoDB can be left unconfigured when developing only the health endpoint.

The API is mounted under `/api`. It provides `GET /api/health`, `POST /api/auth/login`, `GET /api/auth/me`, authenticated `GET /api/dashboard`, and admin-only `GET /api/dashboard/admin`, `GET /api/organizations?search=...`, `POST /api/organizations`, `GET /api/organizations/:id`, and `DELETE /api/organizations/:id`.

There are two roles: `organization` and `admin`. Only admins can create Organization accounts; send `name`, `organizationName`, `email`, and a password of at least 8 characters to `POST /api/organizations`. Clients cannot choose a role. For local development, `npm run seed:admin` creates `admin@gmail.com` with password `admin123`. These demo credentials are unsafe outside local development. In production, explicitly configure `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters. Passwords are hashed with bcrypt, and login tokens are signed with `JWT_SECRET`.

Copy `.env.example` to `.env`, replace `JWT_SECRET` with a private random secret, and start MongoDB before signing in or creating organizations. The health endpoint remains available without MongoDB; database-backed requests return `503` until it is connected.