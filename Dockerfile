# Stage 1: Build the Vite application
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency configs
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy codebase
COPY . .

# Build production assets
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:stable-alpine AS production

# Copy custom Nginx configuration if needed, or use default
# Copy compiled static files from build stage to Nginx directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
