import { Router } from 'express'
import { getTodos, createTodo, updateTodo, deleteTodo } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const todos = await getTodos()
  res.json(todos)
})

router.post('/', async (req, res) => {
  const { title } = req.body
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'title is required' })
  }
  const todo = await createTodo(title.trim())
  res.status(201).json(todo)
})

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' })
  const { title, completed } = req.body
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
    return res.status(400).json({ error: 'title must be non-empty' })
  }
  const todo = await updateTodo(id, {
    ...(title !== undefined && { title: title.trim() }),
    ...(completed !== undefined && { completed })
  })
  if (!todo) return res.status(404).json({ error: 'not found' })
  res.json(todo)
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' })
  const deleted = await deleteTodo(id)
  if (!deleted) return res.status(404).json({ error: 'not found' })
  res.status(204).end()
})

export default router
