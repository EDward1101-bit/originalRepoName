FROM node:22-alpine

WORKDIR /app

# Copy the SDK and install its dependencies
COPY bots/aether-bot-sdk ./bots/aether-bot-sdk
WORKDIR /app/bots/aether-bot-sdk
RUN npm install --omit=dev

# Copy the chatter package files and install dependencies
COPY bots/chatter/package*.json /app/bots/chatter/
WORKDIR /app/bots/chatter
RUN npm install --omit=dev

# Copy the rest of the SDK and chatter source code
COPY bots/aether-bot-sdk /app/bots/aether-bot-sdk
COPY bots/chatter /app/bots/chatter

# agents.json will be stored in /data so it persists across restarts
ENV AGENTS_FILE=/data/agents.json
VOLUME ["/data"]

EXPOSE 4002

CMD ["node", "index.js"]
