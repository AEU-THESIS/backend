# Use a lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies (including devDependencies required for typescript build and prisma generation)
RUN npm install

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

# Push schema changes to MariaDB and start server on container runtime
CMD ["sh", "-c", "npx prisma db push && node dist/src/server.js"]
