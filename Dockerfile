# Build stage
FROM node:20-alpine AS builder

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy all files
COPY . .

# Install all dependencies 
RUN npm ci

# Build the project
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY engine-requirements.js ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/WAProto ./WAProto
COPY --from=builder /app/groups-config*.json ./

# Create directory for auth info
RUN mkdir -p /app/data/baileys_auth_info

# Expose port (Railway will provide PORT env var)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]