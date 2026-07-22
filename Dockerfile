# Frank Watson — static site (zero-dependency Node server)
FROM node:20-alpine

WORKDIR /app

# No dependencies to install; copy app files
COPY package.json server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run as the built-in non-root user
USER node

CMD ["node", "server.js"]
