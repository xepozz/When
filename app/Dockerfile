# Playwright's image ships the matching Chromium and all system fonts/libs.
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY views ./views
COPY public ./public
ENV PORT=3000 HOST=0.0.0.0 DATABASE_PATH=/data/renderkit.db
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/main.js"]
