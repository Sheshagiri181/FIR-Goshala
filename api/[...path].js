const { app, connectDatabase } = require('../server/index.cjs')

function sendJson(res, status, body) {
  if (typeof res.status === 'function') {
    return res.status(status).json(body)
  }
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify(body))
}

module.exports = async function handler(req, res) {
  try {
    await connectDatabase()
  } catch (error) {
    console.error(`Atlas API unavailable (${error.name}). Check the Vercel environment variables and Atlas network access.`)
    return sendJson(res, 503, { error: 'The database is temporarily unavailable. Please try again shortly.' })
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  if (!requestUrl.pathname.startsWith('/api/')) {
    req.url = `/api${requestUrl.pathname}${requestUrl.search}`
  }
  return app(req, res)
}
