FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Install only production dependencies (--production flag works with npm 7+)
RUN npm ci --production
RUN npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 🔥 CREATE uploads directory with correct permissions
RUN mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app

# Copy application code
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]