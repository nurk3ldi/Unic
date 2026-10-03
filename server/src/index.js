import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import clubRoutes from './routes/clubs.js';
import eventRoutes from './routes/events.js';
import inviteRoutes from './routes/invites.js';
import postRoutes from './routes/posts.js';
import storyRoutes from './routes/stories.js';
import userRoutes from './routes/users.js';
import streamRoutes from './routes/stream.js';

const app = express();

// В публикации до десяти снимков разом — ей предел выше. Стоит раньше общего:
// разобранное тело общий разбор второй раз не трогает
app.use('/api/posts', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' })); // фото приходит строкой data URL
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stream', streamRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ресурс не найден' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный формат запроса' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Запрос слишком большой' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`Unic API → http://localhost:${port}`));
