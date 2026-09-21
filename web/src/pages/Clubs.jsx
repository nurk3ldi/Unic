import ClubCard from '../components/ClubCard.jsx';
import './Page.css';
import './Clubs.css';

export default function Clubs() {
  return (
    <main className="page">
      <div className="clubs">
        <ClubCard name="IT Club" />
      </div>
    </main>
  );
}
