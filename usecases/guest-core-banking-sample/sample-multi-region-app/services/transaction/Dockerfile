FROM node:18 as build
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run bundle

FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /build/dist .
EXPOSE 3000

CMD ["node", "index.js"]
