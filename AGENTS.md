# Repository Guidelines

## Project Structure & Module Organization
Trill is an Urbit social application with Nostr and wallet integrations. `backend/` contains the Hoon desk: agents in `app/`, libraries in `lib/`, shared types in `sur/`, threads in `ted/`, and tests in `tests/`. The React/TypeScript frontend lives in `ui/src/`, organized into `components/`, `pages/`, `hooks/`, `logic/`, `state/`, `types/`, and `styles/`. Static assets belong in `ui/public/`; imported assets live in `ui/src/assets/`. Consult `WALLET.md` and `TOPICS_API.md` for integration details.

## Build, Test, and Development Commands
Run frontend commands from `ui/` using the provided Nix development environment:

- `bun install`: resolve dependencies; several Urbit packages require the sibling `../../../urbit/bun/` checkout.
- `bun run dev`: start Vite at `http://localhost:5173/apps/nostrill/`.
- `bun run check`: run TypeScript project checks.
- `bun run build`: type-check and produce the production bundle.
- `bun run preview`: serve the production build locally.
- `bun run test`: run the existing Bun smoke suite.
- `bun run test:e2e`: run Playwright Chromium tests; starts Vite automatically.

If required tools are missing, ask for them in the environment rather than installing them imperatively.

## Coding Style & Naming Conventions
Follow adjacent code: TypeScript uses two-space indentation, double quotes, and semicolons. Use PascalCase for component filenames, camelCase for functions and variables, and `@/` imports for paths under `ui/src/`. Preserve Hoon indentation, rune layout, and existing hyphenated names. No formatter or lint command is currently configured in package scripts.

## Testing Guidelines
Prefer E2E coverage in `ui/tests/e2e/*.spec.cjs`. Produce repeatable evidence, such as explicit screenshots; Playwright retains failure screenshots and traces in `ui/test-results/playwright/`. Browser tests mock Urbit endpoints, so report live-ship verification separately. No numeric coverage threshold is configured. Never write unit tests after implementation; if isolation is necessary, enumerate failure cases first.

## Commit & Pull Request Guidelines
History uses short descriptive subjects, sometimes prefixed by area, such as `Wallet UI:`. Keep commits focused. PRs should explain behavior changes, list validation commands and results, link relevant issues, and include screenshots for UI changes. Pushes to `master` deploy the backend desk through GitHub Actions.

## Workspace & Security
Preserve unrelated edits. Never edit or commit `NOTES.md`, or commit `bulk/`. Keep wallet secrets and deployment credentials out of source and logs.
