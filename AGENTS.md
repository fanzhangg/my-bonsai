# Repository workflow

- Use `dev` for normal development, commits, and pushes. Keep its upstream set to `origin/dev`.
- Keep `main` as the GitHub default and production branch. GitHub Actions promotes tested `dev` commits to `main`; do not push development changes directly to `main`.
- Run `npm test` before pushing application changes. CI runs the full suite on Node.js 24.
- If promotion reports that `main` has diverged, merge `origin/main` into `dev`, resolve conflicts, and push `dev` so CI tests the combined result. Never force-push `main` or bypass required checks.
- Preserve unrelated uncommitted work. Keep `.env`, credentials, and local `data/` out of commits.
- See the development and CI section in `README.md` for the full process.
