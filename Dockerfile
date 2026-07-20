FROM node:20 AS build-stage

WORKDIR /app

COPY package*.json ./

COPY . .

RUN npm install

RUN npm run build

FROM node:20-alpine AS runtime-stage

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY --from=build-stage /app/dist ./dist

EXPOSE 5000

USER node

CMD [ "node", "dist/server.js" ]