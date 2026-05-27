FROM node:22-alpine

WORKDIR /app

# Copy the SDK and the bot package files
COPY bots/aether-bot-sdk ./bots/aether-bot-sdk
COPY bots/chatter/package*.json ./bots/chatter/

WORKDIR /app/bots/chatter
RUN npm install --omit=dev

# Copy the rest of the bot and SDK source code
COPY bots/chatter ./
COPY bots/aether-bot-sdk ../aether-bot-sdk

# agents.json will be stored in /data so it persists across restarts
ENV AGENTS_FILE=/data/agents.json
VOLUME ["/data"]

EXPOSE 4002

CMD ["node", "index.js"]
