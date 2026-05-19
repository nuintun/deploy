---
name: code-style
description: Comprehensive code style guide for TypeScript/JavaScript projects.
---

# Code Style Rules

Follow these conventions strictly when generating or modifying TypeScript/JavaScript code.

## Naming Conventions

- Variables and functions: `camelCase` (e.g., `machineMap`, `readEntries`)
- Classes and interfaces: `PascalCase` (e.g., `class FileWalker`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PORT`)
- Private class fields: use `#prefix` (e.g., `#operationId`)
- Avoid abbreviations; use descriptive names.

## Import Order

- Sort by line length (ascending) first: shorter imports before longer ones.
- Then sort alphabetically (case‑sensitive): uppercase before lowercase for same length.

## Formatting

- Indentation: 2 spaces.
- Always use curly braces for control statements.
- Opening brace on the same line.
- Use blank lines to separate logical sections.

## Comments

- Module headers: `/** @module module-name */`
- Exported interfaces: `/** @interface Name @description ... */`
- Functions: use `@param` and `@returns`.
- Inline comments explain _why_, not what.

## TypeScript Conventions

- Use `const enum` for compile‑time constants.
- Avoid non‑null assertions (`!`) – use type guards.
- Minimize type assertions (`as`) – improve type definitions instead.
- Use type guards (e.g., `function isFtp(ctx): ctx is FtpContext`).

## Error Handling

- Use `try-catch` for async operations.
- Check error type with `instanceof`.
- Provide meaningful error messages.

## Code Organization

- Group files by feature (e.g., `components/`, `utils/`).
- Export only necessary public API.
- Avoid circular dependencies.

## Checklist (to self‑verify)

- Variable names follow camelCase/PascalCase/UPPER_SNAKE_CASE
- Imports sorted by length, then alphabetically (case‑sensitive)
- Control statements use curly braces
- Public APIs have JSDoc documentation
- No unnecessary non‑null assertions (`!`)
- Code passes TypeScript compilation
