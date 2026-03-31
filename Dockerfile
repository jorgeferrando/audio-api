FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

RUN mkdir -p uploads/originals uploads/processed

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
