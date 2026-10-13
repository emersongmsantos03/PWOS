FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
# The runtime starts the application with `vite preview`, which is declared as a
# development dependency. Keep dev dependencies in this image so the server
# executable is available at container startup.
RUN npm ci --include=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/vite.config.ts ./vite.config.ts
# Todos os módulos .ts da raiz importados pelo vite.config.ts (uma lista fixa já
# derrubou uma revisão quando um módulo novo ficou de fora).
COPY --from=build /app/*.ts ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/public ./public
COPY --from=build /app/apps ./apps
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["sh", "-c", "node scripts/validate-production-data.mjs && npm start"]
