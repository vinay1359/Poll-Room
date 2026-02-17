export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="brand" href="/">
              <span className="brand-mark">PB</span>
              <span className="brand-text">Pollbox</span>
            </a>
            <p className="muted">
              Real-time poll rooms with transparent anti-abuse protection. Build polls that stay honest at scale.
            </p>
          </div>

          <div className="footer-links">
            <div>
              <p className="footer-label">Product</p>
              <div className="footer-link-list">
                <a href="/#how">How it works</a>
                <a href="/#create">Create poll</a>
                <a href="/#recent">Recent polls</a>
              </div>
            </div>

            <div>
              <p className="footer-label">Resources</p>
              <div className="footer-link-list">
                <a href="#">Documentation</a>
                <a href="#">Support</a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="muted">© {new Date().getFullYear()} Pollbox. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
