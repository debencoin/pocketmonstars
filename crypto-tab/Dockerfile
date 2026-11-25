FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]
