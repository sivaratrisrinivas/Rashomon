import { Elysia } from 'elysia';

const app = new Elysia()
  .get('/', () => ({ status: 'ok' }))
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);