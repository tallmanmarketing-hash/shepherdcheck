FROM node:20-slim

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY package*.json ./

# Install all deps (sql.js is pure JS — no compilation needed)
RUN npm install --prefix backend && npm install --prefix frontend

# Build frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Copy backend source
COPY backend/ ./backend/

EXPOSE 3001

CMD ["node", "backend/index.js"]