# customAOV API

Fastify + TypeScript backend for customAOV.

From the repository root:

```sh
npm install
npm run dev:api
npm test --workspace @customaov/api
```

Build with `npm run build --workspace @customaov/api`, then run the compiled server
with `npm start --workspace @customaov/api`.

Environment variables:

- `HOST` — listen address (default `127.0.0.1`)
- `PORT` — listen port (default `6174`)
- `LOG_LEVEL` — `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`
- `NODE_ENV` — `development`, `test`, or `production`
