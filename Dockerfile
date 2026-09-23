FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

# Expose server port
ENV PORT=3000
EXPOSE 3000

# Start dashboard server
CMD ["node", "src/server/dashboard-server.js"]
