FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

ENV VITE_API_BASE_URL=http://localhost:8000

CMD ["npx", "vite", "dev", "--host", "0.0.0.0", "--port", "5173"]
