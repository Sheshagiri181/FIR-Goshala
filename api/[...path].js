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
    console.error('========== MONGODB CONNECTION ERROR ==========')
    console.error('Name:', error?.name)
    console.error('Message:', error?.message)
    console.error('Code:', error?.code)
    console.error('CodeName:', error?.codeName)
    console.error('Reason:', error?.reason?.message)
    console.error('================================================')

    return sendJson(res, 503, {
      error: 'The database is temporarily unavailable. Please try again shortly.'
    })
  }

  const requestUrl = new URL(req.url, 'http://localhost')

  if (!requestUrl.pathname.startsWith('/api/')) {
    req.url = `/api${requestUrl.pathname}${requestUrl.search}`
  }

  return app(req, res)
}
