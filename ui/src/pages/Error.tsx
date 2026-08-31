import "@/styles/ErrorPage.css";
import Icon from "@/components/Icon";
import { Link } from "wouter";
export function P404() {
  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-icon-wrapper">
          <Icon name="crow" size={80} />
        </div>
        <h1 className="error-title">404</h1>
        <h2 className="error-subtitle">Page Not Found</h2>
        <p className="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="error-actions">
          <Link href="/f/nostr">
            <button className="error-btn primary">
              <Icon name="home" size={18} />
              Go to Feed
            </button>
          </Link>
          <Link href="/sets">
            <button className="error-btn secondary">
              <Icon name="settings" size={18} />
              Settings
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ErrorPage({ msg }: { msg: string }) {
  return (
    <div>
      <P404 />
      <h3>{msg}</h3>
      <div className="error-page">
        <div className="error-content">
          <div className="error-icon-wrapper">
            <Icon name="crow" size={80} />
          </div>
          <h1 className="error-title">Oops!</h1>
          <h2 className="error-subtitle">Something went wrong</h2>
          <p className="error-message">{msg}</p>
          <div className="error-actions">
            <Link href="/apps/nostrill/f/nostr">
              <button className="error-btn primary">
                <Icon name="home" size={18} />
                Go to Feed
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
