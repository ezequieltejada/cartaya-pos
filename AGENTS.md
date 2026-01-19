# Agent Instructions (Cartaya POS)

This repo contains an Ionic + Angular (standalone) app under `cartayaPos/`.
Most day-to-day work (build/lint/test) should be run from `cartayaPos/`.

## Quick Start

- Install deps: `cd cartayaPos && npm ci`
- Run dev server: `cd cartayaPos && npm run start` (uses `ionic serve --external`)

## Build / Lint / Test

Run these from `cartayaPos/` unless stated otherwise.

### Build

- Production build: `npm run build` (runs `ng build`; outputs to `cartayaPos/www/`)
- Dev watch build: `npm run watch` (`ng build --watch --configuration development`)

### Lint

- Lint (TS + templates): `npm run lint` (runs `ng lint`)

Notes:
- Lint patterns are configured in `cartayaPos/angular.json` under `architect.lint.options.lintFilePatterns`.

### Unit tests (Karma + Jasmine)

- Run all tests (watch): `npm test` (runs `ng test`)
- Run all tests (CI-style, no watch): `npx ng test --configuration=ci`

#### Run a single spec file

Use Angular CLI’s `--include` to target a spec.

- Single spec file:
  - `npx ng test --include='src/app/core/services/auth.service.spec.ts'`
- Match by glob:
  - `npx ng test --include='**/language.service.spec.ts'`

The repo already includes an example script:
- `npm run test:i18n` (runs `ng test --include='**/language.service.spec.ts'`)

#### Run a single test (focused)

Prefer Jasmine focus when you truly need one test:
- Change `describe(...)` → `fdescribe(...)` or `it(...)` → `fit(...)`

Rules of thumb:
- Don’t commit focused specs (`fdescribe`/`fit`). Revert before finalizing.
- Prefer `--include` over `fdescribe` when possible.

### E2E tests

No e2e runner is configured in this repo (no Cypress/Playwright config detected).

## Project Layout

- App source: `cartayaPos/src/`
- Angular app code: `cartayaPos/src/app/`
- Native shells:
  - Android: `cartayaPos/android/`
  - iOS: `cartayaPos/ios/`

## Code Style (TypeScript / Angular)

Follow the existing code and the enforced ESLint/TS settings.

### Formatting

- Indentation: 2 spaces (see `cartayaPos/.editorconfig`).
- Strings: prefer single quotes in TS (see `cartayaPos/.editorconfig`).
- Trailing whitespace: trimmed, final newline required.

This repo does not define Prettier; rely on ESLint + existing formatting.

### TypeScript strictness

TypeScript is strict (see `cartayaPos/tsconfig.json`):
- `strict: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `noPropertyAccessFromIndexSignature: true`
- `noImplicitOverride: true`

Guidelines:
- Avoid `any`; it is allowed but warned (`@typescript-eslint/no-explicit-any: warn`).
- Prefer `unknown` for untyped external data and narrow it.
- Keep public APIs well-typed (services, models, component inputs/outputs).

### Imports

Observed conventions in `cartayaPos/src/app/`:
- Group imports roughly as:
  1) Angular/framework (`@angular/*`, `@ionic/*`)
  2) Third-party (`rxjs`, `@ngx-translate/*`, other libs)
  3) App-local relative imports (`./...`, `../...`)
- Prefer `import type { ... }` for type-only imports when useful (see `cartayaPos/capacitor.config.ts`).
- Prefer direct named imports rather than namespace imports.

RxJS specifics:
- Favor pipeable operators (`pipe(catchError(...), map(...))`).
- Imports can be from `rxjs` or `rxjs/operators`; match the local file’s style.

### Angular patterns

- Standalone routing/components are used (see `cartayaPos/src/app/app.routes.ts`).
- Prefer DI via `inject(...)` over constructor injection.
  - ESLint encourages it: `@angular-eslint/prefer-inject: warn`.
- Use Angular Signals where already established for state:
  - `signal`, `computed`, and `WritableSignal` are used in services.

Selectors enforced by ESLint (`cartayaPos/.eslintrc.json`):
- Components: selector `app-*` (kebab-case) and class suffix `Page` or `Component`.
- Directives: selector `[appFoo]` (camelCase) and prefix `app`.

### Naming

- Files: kebab-case (Angular/Ionic default): `auth.service.ts`, `order-queue.page.ts`.
- Classes: `PascalCase`.
- Services: `XxxService`.
- Components/pages: `XxxComponent` / `XxxPage`.
- Interceptors:
  - Use functional interceptors (`HttpInterceptorFn`) and name as `xxxInterceptor`.

### Error handling & logging

Follow existing approach:
- Prefer explicit error branches with meaningful messages (`throw new Error('...')`).
- For RxJS/HTTP flows:
  - Use `catchError` to translate errors, restore UI state (e.g., loading signals), and rethrow with `throwError(() => error)` when appropriate.
- For async storage or platform operations:
  - Wrap with `try/catch` and log errors (see token load in `AuthService`).

Logging:
- `console.warn` / `console.error` are used, especially in non-production logic.
- Avoid noisy logs in production paths; if you add logs, gate them behind `!environment.production`.

### State management

- Prefer keeping state in dedicated services (signals) rather than in many components.
- Keep signals `readonly` where possible and mutate via service methods.

### Testing style (Jasmine)

- Tests are written with Jasmine + TestBed.
- Use `jasmine.createSpyObj` for service mocks (see `*.spec.ts`).
- After HTTP tests, verify with `httpMock.verify()`.
- Use `TestBed.runInInjectionContext(...)` for testing functional guards/interceptors.

## Mobile (Capacitor)

Capacitor config lives in `cartayaPos/capacitor.config.ts`.
Native projects are in `cartayaPos/android/` and `cartayaPos/ios/`.

Common tasks (if you need them):
- Sync web build to native: `npx cap sync`
- Open native IDEs: `npx cap open ios` / `npx cap open android`

## Agent Notes

- No Cursor rules found (`.cursorrules` or `.cursor/rules/`).
- No Copilot instructions found (`.github/copilot-instructions.md`).

If you add such rules later, update this file to reflect them.
