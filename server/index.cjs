require('dotenv').config()

const crypto = require('node:crypto')
const express = require('express')
const mongoose = require('mongoose')

const app = express()
const port = Number(process.env.PORT || 3001)
const tokenLifetimeSeconds = 8 * 60 * 60
const maxFollowUpDates = 10

const textFields = [
  'firNo',
  'firDate',
  'policeStation',
  'state',
  'district',
  'vehicleNo',
  'vehicleOwnerName',
  'driverName',
  'driverPhone',
  'otherPersons',
  'fieldDate',
  'courtName',
  'fieldNote',
  'goshalaName',
  'goshalaPhone',
  'goshalaAddress',
  'advocateName',
  'advocatePhone',
  'caseWorker',
  'finalOrderDate',
  'finalOrderNote',
  'orderNo',
]

const requiredFields = [
  'firNo',
  'firDate',
  'policeStation',
  'vehicleNo',
  'goshalaName',
  'goshalaPhone',
  'goshalaAddress',
  'advocateName',
]

const caseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  ...Object.fromEntries(textFields.map((field) => [field, { type: String, default: '' }])),
  cowCount: { type: Number, required: true, min: 1 },
  finalOrderAmount: { type: Number, default: 0, min: 0 },
  important: { type: Boolean, default: false },
  followUpDates: {
    type: [{
      date: { type: String, default: '' },
      reason: { type: String, default: '' },
    }],
    default: [],
    validate: {
      validator: (dates) => dates.length <= maxFollowUpDates,
      message: `A case may have at most ${maxFollowUpDates} follow-up dates.`,
    },
  },
}, { timestamps: true })

const CaseRecord = mongoose.model('CaseRecord', caseSchema)

app.use(express.json({ limit: '64kb' }))

function secureEquals(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

function signToken(username) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.STAFF_TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function isValidToken(token) {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false

  const expectedSignature = crypto.createHmac('sha256', process.env.STAFF_TOKEN_SECRET).update(payload).digest('base64url')
  if (!secureEquals(signature, expectedSignature)) return false

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return claims.sub === process.env.STAFF_USERNAME
      && Number.isFinite(claims.exp)
      && claims.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

function requireStaff(req, res, next) {
  const authorization = req.get('authorization') || ''
  const match = authorization.match(/^Bearer (.+)$/i)
  if (!match || !isValidToken(match[1])) {
    return res.status(401).json({ error: 'Staff sign-in is required. Please sign in again.' })
  }
  return next()
}

function isDateOrEmpty(value) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function normalizeRecord(input, id) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Case details must be provided as an object.' }
  }

  const record = { id }
  for (const field of textFields) {
    record[field] = typeof input[field] === 'string' ? input[field].trim() : ''
  }

  for (const field of requiredFields) {
    if (!record[field]) return { error: `${field} is required.` }
  }
  if (!isDateOrEmpty(record.firDate) || !isDateOrEmpty(record.fieldDate) || !isDateOrEmpty(record.finalOrderDate)) {
    return { error: 'Dates must use the YYYY-MM-DD format.' }
  }

  const cowCount = Number(input.cowCount)
  const finalOrderAmount = Number(input.finalOrderAmount || 0)
  if (!Number.isInteger(cowCount) || cowCount < 1) {
    return { error: 'Cattle count must be a whole number greater than zero.' }
  }
  if (!Number.isFinite(finalOrderAmount) || finalOrderAmount < 0) {
    return { error: 'Final order amount must be zero or greater.' }
  }

  const submittedFollowUps = input.followUpDates || []
  if (!Array.isArray(submittedFollowUps) || submittedFollowUps.length > maxFollowUpDates) {
    return { error: `A case may have at most ${maxFollowUpDates} follow-up dates.` }
  }

  const followUpDates = submittedFollowUps.map((item) => {
    if (typeof item === 'string') return { date: item, reason: '' }
    return {
      date: typeof item?.date === 'string' ? item.date.trim() : '',
      reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
    }
  }).filter((item) => item.date || item.reason)
  if (followUpDates.some((item) => !isDateOrEmpty(item.date))) {
    return { error: 'Follow-up dates must use the YYYY-MM-DD format.' }
  }

  record.cowCount = cowCount
  record.finalOrderAmount = finalOrderAmount
  record.important = input.important === true
  record.followUpDates = followUpDates
  return { record }
}

function serializeRecord(record) {
  const { _id, __v, createdAt, updatedAt, ...data } = record
  return data
}

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'database unavailable' })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!secureEquals(username, process.env.STAFF_USERNAME) || !secureEquals(password, process.env.STAFF_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect username or password.' })
  }
  return res.json({ token: signToken(username) })
})

app.get('/api/records', async (req, res) => {
  const records = await CaseRecord.find().sort({ firDate: -1, createdAt: -1 }).lean()
  return res.json(records.map(serializeRecord))
})

app.post('/api/records', requireStaff, async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''
  if (!id) return res.status(400).json({ error: 'Case ID is required.' })
  const normalized = normalizeRecord(req.body, id)
  if (normalized.error) return res.status(400).json({ error: normalized.error })

  try {
    const record = await CaseRecord.create(normalized.record)
    return res.status(201).json(serializeRecord(record.toObject()))
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A case with this ID already exists.' })
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message })
    throw error
  }
})

app.put('/api/records/:id', requireStaff, async (req, res) => {
  const normalized = normalizeRecord(req.body, req.params.id)
  if (normalized.error) return res.status(400).json({ error: normalized.error })

  try {
    const record = await CaseRecord.findOneAndUpdate(
      { id: req.params.id },
      normalized.record,
      { new: true, runValidators: true },
    ).lean()
    if (!record) return res.status(404).json({ error: 'Case record was not found.' })
    return res.json(serializeRecord(record))
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message })
    throw error
  }
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  console.error('API request failed:', error.message)
  return res.status(500).json({ error: 'The server could not complete the request.' })
})

async function start() {
  const requiredEnvironment = ['MONGODB_URI', 'STAFF_USERNAME', 'STAFF_PASSWORD', 'STAFF_TOKEN_SECRET']
  const missing = requiredEnvironment.filter((name) => !process.env[name])
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}. Configure them in the root .env file.`)
    process.exitCode = 1
    return
  }
  if (process.env.STAFF_TOKEN_SECRET.length < 32) {
    console.error('STAFF_TOKEN_SECRET must be at least 32 characters long.')
    process.exitCode = 1
    return
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  } catch (error) {
    console.error(`Could not connect to MongoDB Atlas (${error.name}). Check the URI, database user, and Atlas network access settings.`)
    process.exitCode = 1
    return
  }

  app.listen(port, () => {
    console.log(`FIR Goshala API listening on http://localhost:${port}`)
  })
}

start()
