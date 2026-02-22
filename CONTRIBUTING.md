# Contributing to CUI Internship Management System UI

Thank you for taking the time to contribute! 🎉  
The following guidelines will help you get started quickly and keep the codebase consistent.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
3. [Setting Up Your Development Environment](#setting-up-your-development-environment)
4. [Branch Naming Convention](#branch-naming-convention)
5. [Commit Message Guidelines](#commit-message-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Coding Standards](#coding-standards)
8. [Reporting Bugs](#reporting-bugs)
9. [Suggesting Enhancements](#suggesting-enhancements)

---

## Code of Conduct

By participating in this project you agree to be respectful and constructive in all interactions.  
Harassment or discriminatory language of any kind will not be tolerated.

---

## How Can I Contribute?

- **Bug fixes** — Find and fix an issue listed on the [Issues](../../issues) page.
- **New features** — Implement functionality described in open issues or the project roadmap.
- **Documentation** — Improve `README.md`, `learn.md`, inline comments, or any other docs.
- **Tests** — Increase test coverage by adding or improving Jasmine/Karma unit tests.
- **UI/UX improvements** — Improve accessibility, responsiveness, or visual design.

---

## Setting Up Your Development Environment

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/cui_Internship_system_UI.git
cd cui_Internship_system_UI

# 2. Add the upstream remote
git remote add upstream https://github.com/ZainulabdeenOfficial/cui_Internship_system_UI.git

# 3. Install dependencies
npm install

# 4. Start the development server
npm start
```

> **Tip:** Refer to [`learn.md`](./learn.md) for a detailed walkthrough of the project architecture and tech stack.

---

## Branch Naming Convention

Create a new branch from `master` (or the current default branch) for every contribution.  
Use the following naming pattern:

| Type        | Pattern                        | Example                        |
|-------------|-------------------------------|--------------------------------|
| Feature     | `feature/<short-description>` | `feature/add-weekly-log-form`  |
| Bug fix     | `fix/<short-description>`     | `fix/login-redirect-loop`      |
| Documentation | `docs/<short-description>`  | `docs/update-readme`           |
| Chore / Refactor | `chore/<short-description>` | `chore/upgrade-angular-20`  |

---

## Commit Message Guidelines

Follow the **Conventional Commits** format:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**

```
feat(student): add weekly log submission form
fix(auth): resolve JWT expiry redirect issue
docs: add contributing guide
```

- Use the imperative mood ("add" not "added").
- Keep the summary line under 72 characters.
- Reference related issues in the footer: `Closes #42`

---

## Pull Request Process

1. **Sync your fork** with the upstream before opening a PR:
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```
2. **Run the tests** to ensure nothing is broken:
   ```bash
   npm test
   npm run build
   ```
3. **Open a Pull Request** against the `master` branch of the upstream repository.
4. Fill in the PR template — describe *what* was changed and *why*.
5. Link any related issues (e.g. `Closes #12`).
6. Wait for a code review. Address all requested changes and push to the same branch — the PR updates automatically.
7. Once approved, a maintainer will merge the PR.

---

## Coding Standards

- **Language:** TypeScript — enable `strict` mode; avoid `any`.
- **Formatting:** The project includes an `.editorconfig`. Use it. Prettier is configured for HTML files.
- **Angular style guide:** Follow the [Angular Style Guide](https://angular.dev/style-guide).
- **Component naming:** Use `PascalCase` for class names and `kebab-case` for selectors.
- **Services:** Place business logic in services, keep components thin.
- **Forms:** Prefer Reactive Forms over Template-driven forms for new work.
- **Tests:** Write a `.spec.ts` file for every new service or component.
- **No console.log:** Remove all debug `console.log` statements before opening a PR.

---

## Reporting Bugs

Before opening a bug report:

- Check if the issue already exists in the [Issues](../../issues) list.
- If not, [open a new issue](../../issues/new) and include:
  - A clear, descriptive title.
  - Steps to reproduce the problem.
  - Expected vs. actual behavior.
  - Screenshots or error logs if applicable.
  - Browser and OS version.

---

## Suggesting Enhancements

- [Open a new issue](../../issues/new) with the label **enhancement**.
- Describe the feature and the problem it solves.
- Include mockups or examples if possible.

---

We appreciate every contribution, big or small. Thank you for helping make this project better! 🚀
