# Repository Guidelines

## Project Structure & Module Organization
This repository is a small monorepo with three services:
- `frontend/`: React + Vite UI. Main code is in `frontend/src/` (`components/`, `pages/`, `hooks/`, `assets/`).
- `ProductService/`: Node.js/Express product API. Source is in `ProductService/src/` (`controllers/`, `routes/`, `services/`, `models/`, `middlewares/`, `config/`, `scripts/`).
- `UserService/`: Spring Boot user/auth API. Java code is in `UserService/src/main/java/...`; tests are in `UserService/src/test/java/...`; config is in `UserService/src/main/resources/`.

## Build, Test, and Development Commands
Run commands from each service directory.

Frontend (`frontend/`):
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run build`: create production build.
- `npm run lint`: run ESLint.
- `npm run preview`: preview production build locally.

Product service (`ProductService/`):
- `npm install`
- `npm run dev`: start API (`src/index.js`).
- `npm start`: same runtime entry as `dev`.

User service (`UserService/`):
- `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`): run service.
- `./mvnw test`: run JUnit tests.
- `docker compose up --build`: run with containerized dependencies.

## Coding Style & Naming Conventions
- JavaScript/React: 2-space indentation, semicolons, `camelCase` for variables/functions, `PascalCase` for React components (for example `ProductSkeleton.jsx`).
- Java/Spring: standard Java conventions (`PascalCase` classes, `camelCase` methods/fields, lowercase package names).
- Keep file names consistent with existing patterns: component names in `PascalCase` or kebab-case where already used (for example `product-card.jsx`).
- Run `npm run lint` in `frontend/` before opening a PR.

## Testing Guidelines
- `UserService` uses Spring Boot + JUnit (`*Tests.java` naming, e.g., `UserServiceApplicationTests.java`).
- Add/update tests for new controller, service, and security logic.
- `frontend` and `ProductService` currently have no formal test scripts; at minimum, verify critical flows manually and document what was tested in the PR.

## Commit & Pull Request Guidelines
Git history currently uses short, direct messages (for example `Initial commit`, `update readme & init`). Follow this style with imperative summaries, and prefer scope prefixes when useful (example: `frontend: fix admin login redirect`).

For PRs, include:
- clear problem/solution description,
- affected module(s) (`frontend`, `ProductService`, `UserService`),
- setup or migration notes,
- screenshots/GIFs for UI changes,
- linked issue/task when available.
