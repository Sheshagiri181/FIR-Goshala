const path = require('node:path')
const crypto = require('node:crypto')
const express = require('express')
const session = require('express-session')
const { MongoStore } = require('connect-mongo')
const { MongoClient, ObjectId } = require('mongodb')

require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const port = Number(process.env.PORT || 3001)
const databaseName = process.env.MONGODB_DB || 'goshala_fir'
const mongoUri = process.env.MONGODB_URI
const sessionSecret = process.env.SESSION_SECRET
const recordFields = [
  'firNo', 'firDate', 'policeStation', 'vehicleNo', 'cowCount', 'fieldDate', 'fieldNote',
  'boatName', 'boatRegistrationNo', 'boatOperator', 'boatRoute',
  'goshalaName', 'goshalaAddress', 'goshalaPhone', 'advocateName', 'advocatePhone',
  'finalOrderDate', 'orderNo',
]
const requiredFields = [
  'firNo', 'firDate', 'policeStation', 'vehicleNo', 'cowCount', 'goshalaName',
  'goshalaAddress', 'goshalaPhone', 'advocateName', 'advocatePhone',
]

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function toRecord(document) {
  const { _id, ...record } = document
  return { ...record, id: _id.toString() }
}

function parseRecord(input) {
  const record = Object.fromEntries(recordFields.map((field) => [field, input[field] == null ? '' : String(input[field]).trim()]))
  record.cowCount = Number(input.cowCount)

  const missing = requiredFields.filter((field) => !record[field])
  if (missing.length) return { error: `Required fields are missing: ${missing.join(', ')}` }
  if (!Number.isSafeInteger(record.cowCount) || record.cowCount < 1) return { error: 'Cattle count must be a positive whole number.' }

  for (const field of ['firDate', 'fieldDate', 'finalOrderDate']) {
    if (record[field] && !/^\d{4}-\d{2}-\d{2}$/.test(record[field])) {
      return { error: `${field} must be a valid YYYY-MM-DD date.` }
    }
  }
  return { record }
}

function requireStaff(req, res, next) {
  if (!req.session.staff) return res.status(401).json({ error: 'Staff sign-in is required.' })
  next()
}

async function start() {
  if (!mongoUri) throw new Error('MONGODB_URI is missing. Copy .env.example to .env and configure your MongoDB connection URI.')
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.')
  if (!process.env.STAFF_USERNAME || !process.env.STAFF_PASSWORD) throw new Error('STAFF_USERNAME and STAFF_PASSWORD must be configured in .env.')

  const client = new MongoClient(mongoUri)
  await client.connect()
  const database = client.db(databaseName)
  const records = database.collection('fir_records')
  await records.createIndex({ firDate: -1 })

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(session({
    name: 'goshala.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ client, dbName: databaseName, collectionName: 'sessions' }),
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }))

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.get('/api/auth/session', (req, res) => res.json({ authenticated: Boolean(req.session.staff) }))
  app.post('/api/auth/login', (req, res, next) => {
    const { username, password } = req.body || {}
    if (!safeCompare(username || '', process.env.STAFF_USERNAME) || !safeCompare(password || '', process.env.STAFF_PASSWORD)) {
      return res.status(401).json({ error: 'Incorrect username or password.' })
    }
    req.session.regenerate((error) => {
      if (error) return next(error)
      req.session.staff = true
      req.session.save((saveError) => {
        if (saveError) return next(saveError)
        res.json({ authenticated: true })
      })
    })
  })
  app.post('/api/auth/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie('goshala.sid', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
      res.status(204).end()
    })
  })

  app.get('/api/records', async (_req, res, next) => {
    try {
      const documents = await records.find({}).sort({ firDate: -1, _id: -1 }).toArray()
      res.json({ records: documents.map(toRecord) })
    } catch (error) {
      next(error)
    }
  })
  app.post('/api/records', requireStaff, async (req, res, next) => {
    try {
      const { record, error } = parseRecord(req.body || {})
      if (error) return res.status(400).json({ error })
      const result = await records.insertOne(record)
      res.status(201).json({ record: toRecord({ ...record, _id: result.insertedId }) })
    } catch (error) {
      next(error)
    }
  })
  app.put('/api/records/:id', requireStaff, async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' })
      const { record, error } = parseRecord(req.body || {})
      if (error) return res.status(400).json({ error })
      const id = new ObjectId(req.params.id)
      const result = await records.replaceOne({ _id: id }, record)
      if (!result.matchedCount) return res.status(404).json({ error: 'Case record not found.' })
      res.json({ record: toRecord({ ...record, _id: id }) })
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _req, res, _next) => {
    console.error('API request failed:', error.message)
    if (res.headersSent) return
    res.status(500).json({ error: 'The server could not complete the request.' })
  })

  app.listen(port, () => console.log(`Goshala FIR API listening on http://localhost:${port}`))
}

start().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
