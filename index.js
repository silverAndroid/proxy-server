import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { requestId } from 'hono/request-id';
import { pinoLogger } from 'hono-pino'
import pino from "pino";
import { ulid } from "ulid";
import { trace } from "@opentelemetry/api";

const app = new Hono();
app.use('*', requestId({ generator: () => ulid() }));
app.use(
  pinoLogger({
    pino: pino({
      transport: {
        targets: [
          {
            target: 'hono-pino/debug-log',
          },
          {
            target: 'pino-opentelemetry-transport',
            options: {
              logRecordProcessorOptions: {
                processor: 'simple',
              }
            }
          },
        ],
      },
    }),
  }),
);

app.get("/", (c) => c.text("Hello, World!"));

app.post("/proxy", async (c) => {
  let response;
  const requestId = c.get('requestId');
  const { logger } = c.var;
  const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME);

  return tracer.startActiveSpan('proxy', async (span) => {
    try {
      const body = await c.req.json();
      const { url, method = "GET", headers = {}, data } = body;
      span.setAttribute('requestId', requestId);
      span.setAttribute('domain', new URL(url).hostname);
      span.setAttribute('url', url);
      span.setAttribute('method', method);

      if (!url) {
        span.recordException(new Error("URL is required"));
        return c.json({ error: "URL is required" }, 400);
      }

      const fetchOptions = {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      };

      response = await fetch(url, fetchOptions);
      const contentType = response.headers.get("content-type");
      let parsedData;

      if (contentType && contentType.includes("json")) {
        parsedData = await response.json();
      } else {
        parsedData = await response.text();
      }

      return c.json(
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsedData,
        },
        response.status,
      );
    } catch (error) {
      span.recordException(new Error('Failed to proxy request', error));
      logger.error(`Failed to proxy request ${requestId}`, error);
      return c.json({ error: error.message }, 500);
    } finally {
      span.end();
    }
  });
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({ fetch: app.fetch, port });
