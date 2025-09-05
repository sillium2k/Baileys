FROM node:20-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy all source code first (needed for preinstall script)
COPY . .

# Install all dependencies (including dev for build)
RUN npm install

# Build the project
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create directory for auth info
RUN mkdir -p /app/data/baileys_auth_info

# Expose port (Railway will provide PORT env var)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]