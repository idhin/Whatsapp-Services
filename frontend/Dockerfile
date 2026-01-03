# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Node serve
FROM node:20-alpine

WORKDIR /app

# Install serve package globally
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Start serve
CMD ["serve", "-s", "dist", "-l", "3001"]

