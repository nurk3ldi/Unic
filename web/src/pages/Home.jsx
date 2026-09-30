import StoryRail from '../components/StoryRail.jsx';
import './Page.css';
import './Home.css';

/** Главный экран: истории. Лента публикаций (PostCard) встанет под ними, когда появится таблица публикаций. */
export default function Home() {
  return (
    <main className="page">
      <div className="home">
        <StoryRail />
      </div>
    </main>
  );
}
