# CI/CD

This repository starts with a CI quality gate in GitHub Actions. It verifies both runtime surfaces:

- Web app: deterministic npm install, Prisma client generation, TypeScript type-checking, and production Next.js build.
- AI service: deterministic `uv` install, Python module compilation, FastAPI app import, and Docker image build.

## Recommended Deployment Shape

Use two deploy targets:

- **Next.js app**: Vercel is the simplest fit for this stack. Connect the GitHub repo, deploy previews for pull requests, and promote `main` to production.
- **Python AI service**: deploy the Docker image to a container host such as Fly.io, Render, Railway, or AWS ECS. Keep it separate from the Next.js app so model/tool dependencies and scaling are independent.
- **Database**: keep Supabase as the managed PostgreSQL/Auth/Storage layer. Run schema changes deliberately with Prisma/Supabase migrations, not as an automatic side effect of every app deploy.

## Required Secrets For CD

Add these only when the deployment provider is chosen:

- Web: Vercel project/org tokens or the equivalent provider credentials.
- AI service: container registry credentials and host deploy token.
- Runtime: `DATABASE_URL`, Supabase keys, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, PostHog keys, and service URL values.

## Next Steps

1. Add tests, then extend `.github/workflows/ci.yml` to run them.
2. Resolve current npm audit findings before making audit a blocking CI step.
3. Choose the hosting provider for the AI service, then add a separate deploy workflow that runs only after CI passes on `main`.
