FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_PROXY_URL=http://api-gateway:8080
ENV VITE_API_PROXY_URL=${VITE_API_PROXY_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=nodeuser:nodejs /app ./
USER nodeuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3000 >/dev/null || exit 1
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
