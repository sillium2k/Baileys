FROM node:20-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Create directory for auth info
RUN mkdir -p /app/baileys_auth_info

# Expose port (Railway will provide PORT env var)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]