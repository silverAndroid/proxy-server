FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

ENV OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.otel.rururu.dev"
ENV OTEL_NODE_RESOURCE_DETECTORS="env,host,os"
ENV OTEL_SERVICE_NAME="proxy-server"
ENV OTEL_TRACES_EXPORTER="otlp"
ENV NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"

EXPOSE 3000

CMD ["node", "index.js"]
