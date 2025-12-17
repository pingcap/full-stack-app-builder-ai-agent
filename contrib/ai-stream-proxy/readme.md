## Local development / deployment

- a redis server
- nodejs 22.19.0+ runtime
- `.env` or `.env.local` file. See [env.ts](app/utils/env.ts)

```shell
# Install deps
npm ci

# Start server
npm run start
```

See [example.http](./example.http) for http API usages

Run `node test.ts` for basic test.

## Motivation

A lightweight proxy to support:
- Reproduce LLM stream history
- Resume reading stream with other clients
- Recover reading stream after initial connection lost
