import pg from 'pg'

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'todo',
  user: process.env.DB_USER || 'todo',
  password: process.env.DB_PASSWORD || 'todo'
})

pool.on('error', (err) => {
  console.error('pg pool error', err)
})

export async function initDb () {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
  } finally {
    client.release()
  }
}

export async function getTodos () {
  const { rows } = await pool.query('SELECT * FROM todos ORDER BY created_at DESC')
  return rows
}

export async function createTodo (title) {
  const { rows } = await pool.query(
    'INSERT INTO todos (title) VALUES ($1) RETURNING *',
    [title]
  )
  return rows[0]
}

export async function updateTodo (id, fields) {
  const setClauses = []
  const values = []
  let idx = 1
  if (fields.title !== undefined) {
    setClauses.push(`title = $${idx++}`)
    values.push(fields.title)
  }
  if (fields.completed !== undefined) {
    setClauses.push(`completed = $${idx++}`)
    values.push(fields.completed)
  }
  if (setClauses.length === 0) return null
  values.push(id)
  const { rows } = await pool.query(
    `UPDATE todos SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )
  return rows[0] || null
}

export async function deleteTodo (id) {
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [id])
  return rowCount > 0
}
