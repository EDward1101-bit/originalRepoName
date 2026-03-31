# Contributing

## Git Workflow

We use **GitHub Flow**:

1. Create a feature branch from `main`
2. Make changes and commit
3. Open a Pull Request
4. After review, **squash and merge** to `main`

### Feature Branches

- Always branch from `main`
- Keep branches short-lived (1-2 days max)
- Delete branch after merge

### Branch Naming

```
feature/description
bugfix/description
hotfix/description
```

Examples:
```
feature/user-authentication
feature/xmpp-server-setup
bugfix/message-delivery
hotfix/security-patch
```

### Squash Merging

When merging PRs, use **squash merge** to:
- Keep `main` history clean
- Combine multiple commits into one meaningful commit
- Write a good PR title that becomes the commit message

GitHub PR merge button → "Squash and merge"

### PR Title Format

PR titles follow commit message format: `<type>: <description>`

Examples:
- `feat: add user authentication endpoints`
- `fix: resolve message timeout issue`
- `refactor: restructure database models`

## Coding Standards

### Python (Backend)
- Follow PEP 8
- Use type hints (strict mypy)
- Run `ruff check .` before committing
- Run `mypy .` to verify types

### TypeScript/React (Frontend)
- Use strict TypeScript
- Run `npm run lint` before committing
- Run `npm run typecheck` to verify types
- Use Prettier for formatting

## Commit Messages

Format: `<type>: <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

Example:
```
feat: add user authentication endpoints
fix: resolve message delivery timeout issue
```

## Running Checks

```bash
# Backend
cd backend
pip install -r requirements.txt
ruff check .
mypy .

# Frontend
cd frontend
npm install
npx prettier --write .
npm run lint
npm run typecheck
npm run build
```

## Before Pushing

**Always run these commands before pushing to GitHub:**

```bash
# Frontend
cd frontend
npx prettier --write .
npm run lint
npm run typecheck
```

This ensures CI passes and prevents formatting-related failures.

## Database (Supabase)

We use **Supabase** (PostgreSQL) for the database:

- Set up a Supabase project at https://supabase.com
- Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY` from project settings
- Add to backend `.env`:
  ```
  SUPABASE_URL=your_project_url
  SUPABASE_ANON_KEY=your_anon_key
  ```
- Database migrations are managed via Supabase dashboard or CLI
- Use the Python client (`from supabase import create_client`) for data access
