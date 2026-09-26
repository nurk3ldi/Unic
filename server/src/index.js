import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import clubRoutes from './routes/clubs.js';
import eventRoutes from './routes/events.js';
import inviteRoutes from './routes/invites.js';

const app = express();

app.use(express.json({ limit: '1mb' })); // фото приходит строкой data URL
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/invites', inviteRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ресурс не найден' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный формат запроса' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`Unic API → http://localhost:${port}`));
