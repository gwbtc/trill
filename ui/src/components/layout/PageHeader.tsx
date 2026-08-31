import { useLocation } from "wouter";
import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, back, right }: PageHeaderProps) {
  const [_, navigate] = useLocation();
  return (
    <header className="page-header trill-screen-header">
      <div className="page-header-row">
        {back && (
          <button className="page-back-btn" onClick={() => navigate("/f")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
            </svg>
          </button>
        )}
        <div className="page-header-text">
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-sub">{subtitle}</p>}
        </div>
        {right && <div className="page-header-right">{right}</div>}
      </div>
    </header>
  );
}
