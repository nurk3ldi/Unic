import PostCard from '../components/PostCard.jsx';
import StoryRail from '../components/StoryRail.jsx';
import photo1 from '../assets/demo/post-1.webp';
import photo2 from '../assets/demo/post-2.webp';
import photo3 from '../assets/demo/post-3.webp';
import './Page.css';
import './Home.css';

// Демо: публикаций в базе ещё нет — карточка показана на готовых данных.
// Уйдёт вместе с assets/demo, когда появится таблица публикаций
const DEMO_POST = {
  author: { name: 'Медиацентр', photo: null },
  time: '12 часов назад',
  text: 'Съездили всем клубом в горы — это была одна из самых впечатляющих поездок за год. Делимся кадрами, пока впечатления ещё свежие!',
  photos: [photo1, photo2, photo3],
};

/** Главный экран: истории, под ними — публикации клубов. */
export default function Home() {
  return (
    <main className="page">
      <div className="home">
        <StoryRail />

        <div className="feed">
          <PostCard post={DEMO_POST} />
        </div>
      </div>
    </main>
  );
}
