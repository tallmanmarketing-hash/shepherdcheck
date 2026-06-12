FROM node:20-slim

WORKDIR /app

# Install build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Remove build tools (keep image lean)
RUN apt-get purge -y --auto-remove build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source
COPY backend/ ./backend/

EXPOSE 3001

# Serve both API and static files
CMD ["node", "backend/index.js"]