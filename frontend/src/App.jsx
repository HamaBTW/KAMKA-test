import { useState, useEffect } from 'react'

const API = '/api/todos'

export default function App () {
  const [todos, setTodos] = useState([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => { fetchTodos() }, [])

  async function fetchTodos () {
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTodos(await res.json())
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function addTodo (e) {
    e.preventDefault()
    if (!title.trim()) return
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() })
    })
    if (!res.ok) { setError('failed to add'); return }
    setTitle('')
    await fetchTodos()
  }

  async function toggleTodo (todo) {
    const res = await fetch(`${API}/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !todo.completed })
    })
    if (!res.ok) { setError('failed to update'); return }
    await fetchTodos()
  }

  async function deleteTodo (id) {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('failed to delete'); return }
    await fetchTodos()
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>TODO</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={addTodo}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="what needs to be done?"
          style={{ width: '70%', padding: 8 }}
        />
        <button type="submit" style={{ padding: 8, marginLeft: 8 }}>Add</button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map((t) => (
          <li key={t.id} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={t.completed}
              onChange={() => toggleTodo(t)}
            />
            <span style={{ flex: 1, textDecoration: t.completed ? 'line-through' : 'none' }}>
              {t.title}
            </span>
            <button onClick={() => deleteTodo(t.id)} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
