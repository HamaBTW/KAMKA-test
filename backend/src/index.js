import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { initDb } from './db.js'
import todosRouter from './routes/todos.js'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
})

const app = express()

app.use(pinoHttp({ logger }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/todos', todosRouter)

const port = parseInt(process.env.PORT || '3000')

async function start () {
  await initDb()
  logger.info('database initialized')
  app.listen(port, () => {
    logger.info({ port }, 'server started')
  })
}

start().catch((err) => {
  logger.fatal(err, 'failed to start')
  process.exit(1)
})
