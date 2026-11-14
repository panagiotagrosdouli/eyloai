import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import "@/pages/landing.css";

export default function PublicHeader() {
  return (
    <header className="border-b border-[var(--company-border)] bg-[var(--company-surface)]">
      <div className="mx-auto flex max-w-[1350px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-9">
        <Link to="/" aria-label="EYLO home">
          <img
            src={import.meta.env.BASE_URL + "brand/eylo-light.svg"}
            alt="EYLO"
            width="130"
            height="38"
            className="company-brand h-9 w-auto"
          />
        </Link>
        <nav
          aria-label="Public pages"
          className="flex items-center gap-3 text-sm font-semibold"
        >
          <Link to="/company" className="hidden sm:block">
            Company
          </Link>
          <Link to="/plans">Plans</Link>
          <Link to="/contact" className="hidden sm:block">
            Contact
          </Link>
          <ThemeToggle />
          <Link
            to="/discover"
            className="company-primary hidden min-h-11 items-center rounded-xl px-4 sm:inline-flex"
          >
            Explore EYLO
          </Link>
        </nav>
      </div>
    </header>
  );
}
