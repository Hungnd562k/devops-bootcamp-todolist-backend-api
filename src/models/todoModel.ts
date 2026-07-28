import pool from '../config/database';
import { logger } from '../config/logger';

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
}

class TodoModel {
  async initDatabase() {
    const query = `
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT false,
        priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
      CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
      CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
    `;

    try {
      await pool.query(query);
      logger.info('Database tables initialized successfully', { log_type: 'database' });
    } catch (error) {
      logger.error('Error initializing database', error, { log_type: 'database' });
      throw error;
    }
  }

  async getAllTodos(filters?: { completed?: boolean; priority?: string; search?: string }): Promise<Todo[]> {
    let query = 'SELECT * FROM todos WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.completed !== undefined) {
      query += ` AND completed = $${paramCount}`;
      values.push(filters.completed);
      paramCount++;
    }

    if (filters?.priority) {
      query += ` AND priority = $${paramCount}`;
      values.push(filters.priority);
      paramCount++;
    }

    if (filters?.search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getTodoById(id: number): Promise<Todo | null> {
    const result = await pool.query('SELECT * FROM todos WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createTodo(todo: CreateTodoInput): Promise<Todo> {
    const { title, description, priority = 'medium', due_date } = todo;
    const query = `
      INSERT INTO todos (title, description, priority, due_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [title, description || null, priority, due_date || null];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateTodo(id: number, updates: UpdateTodoInput): Promise<Todo | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount}`);
      values.push(updates.title);
      paramCount++;
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(updates.description);
      paramCount++;
    }

    if (updates.completed !== undefined) {
      fields.push(`completed = $${paramCount}`);
      values.push(updates.completed);
      paramCount++;
    }

    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramCount}`);
      values.push(updates.priority);
      paramCount++;
    }

    if (updates.due_date !== undefined) {
      fields.push(`due_date = $${paramCount}`);
      values.push(updates.due_date || null);
      paramCount++;
    }

    if (fields.length === 0) {
      return this.getTodoById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE todos
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async toggleTodo(id: number): Promise<Todo | null> {
    const query = `
      UPDATE todos
      SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async deleteTodo(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export default new TodoModel();
