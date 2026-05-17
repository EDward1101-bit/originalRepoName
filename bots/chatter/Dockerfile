FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# agents.json will be stored in /data so it persists across restarts
ENV AGENTS_FILE=/data/agents.json
VOLUME ["/data"]

EXPOSE 4002

CMD ["node", "index.js"]
