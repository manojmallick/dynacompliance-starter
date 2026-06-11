# Full node:24 (buildpack-deps based) has gcc/g++/make/python3 so native deps (e.g.
# sqlite3) build reliably. Node 24 (not 20) is required: @dynatrace-oss/dynatrace-mcp-server
# bundles an undici that calls webidl.util.markAsUncloneable, added in Node 22+.
FROM node:24
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
