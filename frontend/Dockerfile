FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && npm install vite-plugin-node-polyfills

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
