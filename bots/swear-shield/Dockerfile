FROM node:22-alpine

WORKDIR /app

# Copy the SDK and the bot package files
COPY bots/aether-bot-sdk ./bots/aether-bot-sdk
COPY bots/swear-shield/package*.json ./bots/swear-shield/

WORKDIR /app/bots/swear-shield
RUN npm install --omit=dev

# Copy the rest of the bot and SDK source code
COPY bots/swear-shield ./
COPY bots/aether-bot-sdk ../aether-bot-sdk

EXPOSE 4001

CMD ["node", "index.js"]
