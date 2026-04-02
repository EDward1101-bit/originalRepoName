FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "npm install vite-plugin-node-polyfills && npm run dev -- --host"]
