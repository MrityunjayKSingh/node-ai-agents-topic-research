import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { signToken } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password || username.length < 3 || password.length < 6) {
    res.status(400).json({ error: 'Username must be ≥3 chars and password ≥6 chars' });
    return;
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username],
  });

  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    args: [id, username, passwordHash, Date.now()],
  });

  const token = signToken(id, username);
  res.status(201).json({ token, username });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const result = await db.execute({
    sql: 'SELECT id, password_hash FROM users WHERE username = ?',
    args: [username],
  });

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const row = result.rows[0];
  const valid = await bcrypt.compare(password, row.password_hash as string);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(row.id as string, username);
  res.json({ token, username });
});

export default router;
