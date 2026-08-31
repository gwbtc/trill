export default function WelcomeModal() {
  return (
    <div className="welcome-modal">
      <div className="welcome-header">
        <div className="welcome-logo-glow"></div>
        <h1>Welcome to New Trill!</h1>
        <p className="welcome-tagline">
          Your sovereign social experience begins here
        </p>
      </div>

      <div className="welcome-intro">
        <p>
          Trill is a truly free and sovereign social media platform, powered by
          Urbit and now connected to the wider Nostr network.
        </p>
      </div>

      <div className="welcome-cards">
        <div className="welcome-card">
          <div className="welcome-card-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h3>Follow Your Friends</h3>
          <p>
            Search for and follow people you know to build your personalized
            feed. Your Following feed shows posts from everyone you follow.
          </p>
        </div>

        <div className="welcome-card">
          <div className="welcome-card-icon nostr">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <h3>Add Nostr Relays</h3>
          <p>
            Connect to Nostr relays in Settings to interact with the wider Nostr
            network. More relays means more content and better connectivity!
          </p>
        </div>
      </div>

      <div className="welcome-tips">
        <h4>Quick Tips</h4>
        <ul>
          <li>
            <span className="tip-icon">👤</span> Set your public profile in the
            Profile page
          </li>
          <li>
            <span className="tip-icon">🦅</span> Click the crow icon to browse
            different feeds
          </li>
          <li>
            <span className="tip-icon">⚙️</span> Visit Settings to add relays
            and customize your experience
          </li>
          <li>
            <span className="tip-icon">✍️</span> Compose your first post using
            the button at the bottom right
          </li>
        </ul>
      </div>

      <div className="welcome-footer">
        <p>
          Questions or feedback? Reach out on Groups at
          <span className="highlight">~hodler-lorfeb/v769287</span> or{" "}
          <span className="highlight">~polwex</span>
        </p>
      </div>
    </div>
  );
}
