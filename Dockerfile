# Use a lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies (including devDependencies required for typescript build and prisma generation)
RUN npm ci

# Copy Prisma schema and configuration
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build configurations
COPY . .

# Build the TypeScript project (compiles into dist/ folder)
RUN npm run build

# Expose port 3000 for network access
EXPOSE 3000

# Set ownership to the built-in non-root 'node' user
RUN chown -R node:node /usr/src/app

# Drop privileges
USER node

# Start the server without performing schema mutations
CMD ["node", "dist/src/server.js"]
