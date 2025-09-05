# Build stage
FROM node:20-alpine AS builder

# Install dependencies for native modules and build tools
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY engine-requirements.js ./
COPY yarn.lock* ./
COPY tsconfig*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy all source code and config files
COPY . .

# Build the project
RUN npm run build

# Debug: Check what was built
RUN echo "=== Built files ===" \
    && ls -la lib/ \
    && echo "=== WAProto files ===" \
    && ls -la WAProto/ \
    && echo "=== END DEBUG ==="

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy built application and necessary files from builder stage
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/WAProto ./WAProto
COPY --from=builder /app/groups-config*.json ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/engine-requirements.js ./

# Install only production dependencies (skip prepare script)
RUN npm ci --omit=dev --ignore-scripts

# Create directory for auth info
RUN mkdir -p /app/data/baileys_auth_info

# Expose port (Railway will provide PORT env var)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]