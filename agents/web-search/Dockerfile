FROM node:22-alpine

WORKDIR /app

# Copy package files for main app
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies for main app
RUN npm install

# Copy MCP server package files
COPY mcp-server/package*.json ./mcp-server/
COPY mcp-server/tsconfig.json ./mcp-server/

# Install MCP server dependencies
WORKDIR /app/mcp-server
RUN npm install

# Copy MCP server source code and build
COPY mcp-server/src ./src
RUN npm run build

# Go back to main app directory
WORKDIR /app

# Copy main app source code
COPY src ./src

# Build the main application
RUN npm run build

# Start the application
CMD ["npm", "start"]