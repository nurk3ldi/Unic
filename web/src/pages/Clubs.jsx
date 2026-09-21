import ClubCard from '../components/ClubCard.jsx';
import airecLogo from '../assets/airec_logo.png';
import './Page.css';
import './Clubs.css';

export default function Clubs() {
  return (
    <main className="page">
      <div className="clubs">
        <ClubCard name="AIREC" members={42} status="active" photo={airecLogo} />
      </div>
    </main>
  );
}
