import { Request, Response } from 'express';
import todoModel from '../models/todoModel';
import { logger } from '../config/logger';

class TodoController {
  async getAllTodos(req: Request, res: Response) {
    try {
      const { completed, priority, search } = req.query;
      
      const filters: any = {};
      if (completed !== undefined) {
        filters.completed = completed === 'true';
      }
      if (priority) {
        filters.priority = priority as string;
      }
      if (search) {
        filters.search = search as string;
      }

      const todos = await todoModel.getAllTodos(filters);
      res.json(todos);
    } catch (error) {
      logger.error('Error fetching todos', error, { log_type: 'application', operation: 'get_all_todos' });
      res.status(500).json({ error: 'Failed to fetch todos' });
    }
  }

  async getTodoById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid todo ID' });
      }

      const todo = await todoModel.getTodoById(id);
      if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(todo);
    } catch (error) {
      logger.error('Error fetching todo', error, { log_type: 'application', operation: 'get_todo_by_id' });
      res.status(500).json({ error: 'Failed to fetch todo' });
    }
  }

  async createTodo(req: Request, res: Response) {
    try {
      const { title, description, priority, due_date } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (priority && !['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value' });
      }

      const todo = await todoModel.createTodo({
        title: title.trim(),
        description,
        priority,
        due_date,
      });

      res.status(201).json(todo);
    } catch (error) {
      logger.error('Error creating todo', error, { log_type: 'application', operation: 'create_todo' });
      res.status(500).json({ error: 'Failed to create todo' });
    }
  }

  async updateTodo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid todo ID' });
      }

      const { title, description, completed, priority, due_date } = req.body;

      if (title !== undefined && title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }

      if (priority && !['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value' });
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description;
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      if (due_date !== undefined) updates.due_date = due_date;

      const todo = await todoModel.updateTodo(id, updates);
      if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(todo);
    } catch (error) {
      logger.error('Error updating todo', error, { log_type: 'application', operation: 'update_todo' });
      res.status(500).json({ error: 'Failed to update todo' });
    }
  }

  async toggleTodo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid todo ID' });
      }

      const todo = await todoModel.toggleTodo(id);
      if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(todo);
    } catch (error) {
      logger.error('Error toggling todo', error, { log_type: 'application', operation: 'toggle_todo' });
      res.status(500).json({ error: 'Failed to toggle todo' });
    }
  }

  async deleteTodo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid todo ID' });
      }

      const deleted = await todoModel.deleteTodo(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting todo', error, { log_type: 'application', operation: 'delete_todo' });
      res.status(500).json({ error: 'Failed to delete todo' });
    }
  }
}

export default new TodoController();
