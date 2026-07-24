import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import todoRoutes from './routes/todoRoutes';
import todoModel from './models/todoModel';
import pool from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint for Kubernetes liveness probe
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Xin chào tôi tên Hưng 123 hahaha michael jackson', timestamp: new Date().toISOString() });
});

// Readiness check endpoint for Kubernetes readiness probe
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'ready', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({ 
      status: 'not ready', 
      database: 'disconnected',
      timestamp: new Date().toISOString() 
    });
  }
});

// API routes
app.use('/api/todos', todoRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Todo List API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      todos: '/api/todos'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database tables
    await todoModel.initDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://127.0.0.1:${PORT}/health`);
      console.log(`Readiness check: http://127.0.0.1:${PORT}/ready`);
      console.log(`API endpoint: http://127.0.0.1:${PORT}/api/todos`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
