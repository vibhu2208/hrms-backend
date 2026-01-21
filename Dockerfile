FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Install production dependencies (using npm install instead of npm ci 
# because package-lock.json may be out of sync with package.json)
RUN npm install --production --no-audit --no-fund && \
    npm cache clean --force

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