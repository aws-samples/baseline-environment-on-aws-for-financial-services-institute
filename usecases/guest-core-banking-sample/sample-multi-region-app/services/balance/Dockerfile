FROM node:18 as build
WORKDIR /build
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run bundle

FROM node:18

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --production
COPY --from=build /build/dist .
EXPOSE 3000

CMD ["node", "index.js"]
