import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import PhotoViewer from '../components/PhotoViewer.jsx';
import PostCard from '../components/PostCard.jsx';
import PostDialog from '../components/PostDialog.jsx';
import StoryRail from '../components/StoryRail.jsx';
import './Page.css';
import './Home.css';

/** Главный экран: истории, под ними лента публикаций — новые сверху. */
export default function Home() {
  const [feed, setFeed] = useState({ posts: [], tellers: {} });
  // Снимки публикации, открытые на весь экран: { photos, index }
  const [viewing, setViewing] = useState(null);
  // Публикация, открытая в окне с комментариями (её id)
  const [talking, setTalking] = useState(null);
  const [searchParams] = useSearchParams();
  const linked = searchParams.get('post');

  useEffect(() => {
    let alive = true;
    api
      .posts()
      .then((data) => alive && setFeed(data))
      .catch(() => {
        // Молча: истории над лентой остаются, а пустая лента ошибкой не выглядит
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Меняет одну публикацию на месте: карточка в ленте и окно читают одну и ту же. */
  const patch = (id, change) =>
    setFeed((was) => ({
      ...was,
      posts: was.posts.map((item) => (item.id === id ? { ...item, ...change } : item)),
    }));

  async function remove(id) {
    try {
      await api.deletePost(id);
      setFeed((was) => ({ ...was, posts: was.posts.filter((post) => post.id !== id) }));
    } catch (failure) {
      window.alert(failure.message);
    }
  }

  // Пришли по ссылке на публикацию («Отправить») — лента встаёт на ней
  useEffect(() => {
    if (linked) document.getElementById(`post-${linked}`)?.scrollIntoView({ block: 'center' });
  }, [linked, feed]);

  // Лайк виден сразу, сервер догоняет и отдаёт точное число; не вышло — возвращаем как было
  async function like(post) {
    const liked = !post.liked;
    patch(post.id, { liked, likes: post.likes + (liked ? 1 : -1) });
    try {
      patch(post.id, await api.likePost(post.id, liked));
    } catch {
      patch(post.id, { liked: post.liked, likes: post.likes });
    }
  }

  const step = (by) => () => setViewing((was) => ({ ...was, index: was.index + by }));
  const open = feed.posts.find((post) => post.id === talking) ?? null;

  return (
    <main className="page">
      <div className="home">
        <StoryRail />

        <div className="feed">
          {feed.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              teller={feed.tellers[post.teller]}
              onOpen={(index) => setViewing({ photos: post.photos, index })}
              onDelete={() => remove(post.id)}
              onLike={() => like(post)}
              onTalk={() => setTalking(post.id)}
            />
          ))}
        </div>
      </div>

      <PostDialog
        post={open}
        teller={open && feed.tellers[open.teller]}
        onClose={() => setTalking(null)}
        onCount={(comments) => patch(talking, { comments })}
      />

      <PhotoViewer
        photo={viewing ? viewing.photos[viewing.index] : null}
        steps={
          viewing && viewing.photos.length > 1
            ? {
                index: viewing.index,
                count: viewing.photos.length,
                onPrev: viewing.index > 0 ? step(-1) : null,
                onNext: viewing.index < viewing.photos.length - 1 ? step(1) : null,
              }
            : undefined
        }
        onClose={() => setViewing(null)}
      />
    </main>
  );
}
