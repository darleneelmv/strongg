# Strong Gym · imagen para la nube (Render, Railway, VPS con Docker…)
FROM node:22-alpine
WORKDIR /app
ENV MODO=nube \
    DATA_DIR=/data \
    PORT=3000
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
