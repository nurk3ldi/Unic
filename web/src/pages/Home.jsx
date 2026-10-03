import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import PhotoViewer from '../components/PhotoViewer.jsx';
import PostCard from '../components/PostCard.jsx';
import StoryRail from '../components/StoryRail.jsx';
import './Page.css';
import './Home.css';

/** Главный экран: истории, под ними лента публикаций — новые сверху. */
export default function Home() {
  const [feed, setFeed] = useState({ posts: [], tellers: {} });
  // Снимки публикации, открытые на весь экран: { photos, index }
  const [viewing, setViewing] = useState(null);
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
    const patch = (change) =>
      setFeed((was) => ({
        ...was,
        posts: was.posts.map((item) => (item.id === post.id ? { ...item, ...change } : item)),
      }));

    const liked = !post.liked;
    patch({ liked, likes: post.likes + (liked ? 1 : -1) });
    try {
      patch(await api.likePost(post.id, liked));
    } catch {
      patch({ liked: post.liked, likes: post.likes });
    }
  }

  const step = (by) => () => setViewing((was) => ({ ...was, index: was.index + by }));

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
            />
          ))}
        </div>
      </div>

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
