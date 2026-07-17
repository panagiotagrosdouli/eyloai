import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function WebsiteLayout({ children }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="EYLO home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>EYLO AI</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="/#platform">Platform</a>
          <a href="/#research">Research</a>
          <a href="/#open-source">Open Source</a>
        </nav>
        <Link className="button button-small" to="/dashboard">Open dashboard</Link>
      </header>
      {children}
      <footer>
        <span>© {new Date().getFullYear()} EYLO AI</span>
        <span>Research · Innovation · Responsible AI</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WebsiteLayout><Home /></WebsiteLayout>} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<WebsiteLayout><NotFound /></WebsiteLayout>} />
      </Routes>
    </BrowserRouter>
  );
}
