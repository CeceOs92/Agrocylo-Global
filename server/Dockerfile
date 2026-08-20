FROM node:20-alpine

WORKDIR /app

ARG DATABASE_URL=postgresql://agrocylo:agrocylo123@localhost:5432/agrocylo_db
ENV DATABASE_URL=$DATABASE_URL

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && npm start"]
