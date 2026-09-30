import StoryRail from '../components/StoryRail.jsx';
import './Page.css';

/** Главный экран: пока на нём только истории — лента появится следующим шагом. */
export default function Home() {
  return (
    <main className="page">
      <StoryRail />
    </main>
  );
}
