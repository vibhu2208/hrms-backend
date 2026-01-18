# Production-ready Dockerfile for HRMS Backend
FROM node:18-alpine

# Create app directory and set as working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port (configurable via PORT env var, defaults to 5001)
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-5001}/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]
