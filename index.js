import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'

const app = new Hono()
app.use(logger());

app.post('/proxy', async (c) => {
    try {
        const body = await c.req.json()
        const { url, method = 'GET', headers = {}, data } = body

        if (!url) {
            return c.json({ error: 'URL is required' }, 400)
        }

        const fetchOptions = {
            method,
            headers,
            body: data ? JSON.stringify(data) : undefined,
        }

        const response = await fetch(url, fetchOptions)
        const contentType = response.headers.get('content-type')
        let parsedData

        if (contentType && contentType.includes('json')) {
            parsedData = await response.json()
        } else {
            parsedData = await response.text()
        }

        return c.json({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: parsedData,
        }, response.status)

    } catch (error) {
        return c.json({ error: error.message }, 500)
    }
})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})
