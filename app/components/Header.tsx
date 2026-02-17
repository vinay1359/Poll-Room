"use client";

import { ThemeToggle } from "./ThemeToggle";
import { useState, useEffect } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when clicking outside or on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="shell">
        <a className="brand" href="/">
          <span className="brand-mark">PB</span>
          <span className="brand-text">Pollbox</span>
        </a>
        
        <nav className={`nav ${mobileMenuOpen ? "nav-open" : ""}`}>
          <a href="/#how" onClick={handleNavClick}>How it works</a>
          <a href="/#create" onClick={handleNavClick}>Create</a>
          <a href="/#recent" onClick={handleNavClick}>Recent</a>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <a className="cta" href="/#create">
            Start a poll
          </a>
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
