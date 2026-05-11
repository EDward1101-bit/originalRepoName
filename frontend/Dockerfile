FROM node:20-alpine

WORKDIR /app

# Ensure non-root execution for better security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json package-lock.json ./
# Use npm ci instead of npm install for faster, deterministic builds
RUN npm ci --legacy-peer-deps

COPY . .
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
