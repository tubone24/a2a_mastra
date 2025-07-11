FROM node:22-alpine

WORKDIR /app

# Copy package files for main app
COPY agents/web-search/package*.json ./
COPY agents/web-search/tsconfig.json ./

# Install dependencies for main app
RUN npm install

# Copy and build standalone MCP server
COPY standalone-mcp-server/package*.json ./standalone-mcp-server/
COPY standalone-mcp-server/tsconfig.json ./standalone-mcp-server/

# Install standalone MCP server dependencies
WORKDIR /app/standalone-mcp-server
RUN npm install

# Copy standalone MCP server source code and build
COPY standalone-mcp-server/src ./src
RUN npm run build

# Go back to main app directory
WORKDIR /app

# Copy main app source code
COPY agents/web-search/src ./src

# Build the main application
RUN npm run build

# Start the application
CMD ["npm", "start"]