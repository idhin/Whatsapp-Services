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

# Stage 2: Serve with nginx for proper API proxying
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Environment variables for backend connection (can be overridden via docker-compose)
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3001

# Expose port (nginx listens on port 80 by default)
EXPOSE 80

# nginx:alpine image automatically runs envsubst on templates in /etc/nginx/templates/
CMD ["nginx", "-g", "daemon off;"]

