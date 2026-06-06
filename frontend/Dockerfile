FROM node:20-alpine

WORKDIR /app

# Ensure non-root execution for better security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown appuser:appgroup /app

# USER appuser

COPY --chown=appuser:appgroup package.json package-lock.json ./
# Use npm ci instead of npm install for faster, deterministic builds
RUN npm ci --legacy-peer-deps

COPY --chown=appuser:appgroup . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
