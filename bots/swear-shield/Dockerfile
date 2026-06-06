FROM node:22-alpine

WORKDIR /app

# Copy the SDK and install its dependencies
COPY bots/aether-bot-sdk ./bots/aether-bot-sdk
WORKDIR /app/bots/aether-bot-sdk
RUN npm install --omit=dev

# Copy the swear-shield package files and install dependencies
COPY bots/swear-shield/package*.json /app/bots/swear-shield/
WORKDIR /app/bots/swear-shield
RUN npm install --omit=dev

# Copy the rest of the SDK and swear-shield source code
COPY bots/aether-bot-sdk /app/bots/aether-bot-sdk
COPY bots/swear-shield /app/bots/swear-shield

EXPOSE 4001

CMD ["node", "index.js"]
