import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId } from 'hono/request-id';
import { ulid } from "ulid";

const app = new Hono();
app.use('*', requestId({ generator: () => ulid() }));
app.use(logger());

app.get("/", (c) => c.text("Hello, World!"));

app.post("/proxy", async (c) => {
  let response;
  const requestId = c.get('requestId');
  try {
    const body = await c.req.json();
    const { url, method = "GET", headers = {}, data } = body;

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const fetchOptions = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    console.debug(requestId, url, JSON.stringify(fetchOptions, null, 2));
    response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type");
    let parsedData;

    if (contentType && contentType.includes("json")) {
      parsedData = await response.json();
    } else {
      parsedData = await response.text();
    }

    console.debug(requestId, JSON.stringify(parsedData, null, 2));
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
    console.error(`Failed to proxy request ${requestId}`, error);
    return c.json({ error: error.message }, 500);
  }
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({ fetch: app.fetch, port });
