FROM oven/bun:1.2-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY index.ts tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
USER bun
CMD ["bun", "run", "index.ts"]
