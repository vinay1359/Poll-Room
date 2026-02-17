"use client";

import { useEffect, useMemo, useState } from "react";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [expiresAt, setExpiresAt] = useState("");
  const [pollLink, setPollLink] = useState("");
  const [recentPolls, setRecentPolls] = useState<
    Array<{
      id: string;
      question: string;
      created_at: string;
      expires_at: string | null;
      total_votes?: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAddOption = options.length < MAX_OPTIONS;
  
  useEffect(() => {
    async function loadRecent() {
      const response = await fetch("/api/polls");
      if (!response.ok) return;
      const payload = await response.json();
      setRecentPolls(payload.polls ?? []);
    }

    loadRecent();
    
    // Refresh recent polls every 3 seconds for near real-time updates
    const interval = setInterval(loadRecent, 3000);
    
    // Refresh when user returns to the page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadRecent();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const validOptions = useMemo(
    () => options.map((option) => option.trim()).filter(Boolean),
    [options]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPollLink("");

    if (!question.trim() || validOptions.length < MIN_OPTIONS) {
      setError("Add a question and at least two options.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create poll");
      }

      const payload = await response.json();
      const link = `${window.location.origin}/poll/${payload.pollId}`;
      setPollLink(link);
      setQuestion("");
      setOptions(["", ""]);
      setExpiresAt("");
      
      // Refresh the recent polls list to get accurate vote counts
      const refreshResponse = await fetch("/api/polls");
      if (refreshResponse.ok) {
        const refreshPayload = await refreshResponse.json();
        setRecentPolls(refreshPayload.polls ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((option, idx) => (idx === index ? value : option)));
  }

  function addOption() {
    if (!canAddOption) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function setExpirationPreset(hours: number) {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    // Format for datetime-local input (need local time, not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}T${hour}:${minute}`;
    setExpiresAt(formatted);
  }

  async function copyLink() {
    if (!pollLink) return;
    await navigator.clipboard.writeText(pollLink);
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Real-time poll rooms</p>
          <h1>Build polls that stay honest at scale.</h1>
          <p className="lead">
            Create polls with real-time updates, QR code sharing, automatic expiration,
            and transparent anti-spam protection. See vote timelines and get instant results.
          </p>
          <div className="hero-actions">
            <a className="cta" href="#create">Start a poll</a>
            <a className="ghost" href="#how">See how it works</a>
          </div>
          <div className="hero-metrics">
            <div>
              <p className="metric">Real-time</p>
              <p className="muted">Live updates, no refresh</p>
            </div>
            <div>
              <p className="metric">6 layers</p>
              <p className="muted">Anti-spam protection</p>
            </div>
            <div>
              <p className="metric">Mobile</p>
              <p className="muted">QR codes + touch UI</p>
            </div>
          </div>
        </div>
        <div className="hero-panel">
          <p className="panel-label">Quick start</p>
          <p className="panel-title">Create your first poll</p>
          <p className="muted">Takes under 60 seconds.</p>
          <a className="primary" href="#create">Go to form</a>
        </div>
      </section>

      <section id="how" className="how">
        <div className="section-title">
          <h2>How it works</h2>
          <p className="muted">Three steps. Zero fluff.</p>
        </div>
        <div className="how-grid">
          <div className="how-card">
            <p className="step-label">1. Create</p>
            <p>Write a question and add 2-10 options.</p>
          </div>
          <div className="how-card">
            <p className="step-label">2. Share</p>
            <p>Send the link or scan the QR code on mobile.</p>
          </div>
          <div className="how-card">
            <p className="step-label">3. Watch</p>
            <p>Votes update live with timeline graph and auto-expiration.</p>
          </div>
        </div>
      </section>

      <section className="flow">
        <div className="section-title">
          <h2>What happens when someone votes</h2>
          <p className="muted">Clear and transparent, every time.</p>
        </div>
        <ol className="flow-list">
          <li>
            We identify the device using a short-lived cookie and a browser
            fingerprint.
          </li>
          <li>
            We score behavior (time on page, mouse movement) to avoid bots.
          </li>
          <li>
            We apply rate limits to prevent spam attacks.
          </li>
          <li>
            Votes are accepted or rejected clearly - no hidden scoring.
          </li>
        </ol>
      </section>

      <section className="trust">
        <div>
          <h2>How voting works</h2>
          <p className="muted">
            Fair and transparent voting with built-in protections.
          </p>
        </div>
        <div className="trust-list">
          <div>
            <p className="metric">1 vote</p>
            <p className="muted">Per device, per poll</p>
          </div>
          <div>
            <p className="metric">Real-time</p>
            <p className="muted">Results update instantly</p>
          </div>
          <div>
            <p className="metric">Protected</p>
            <p className="muted">Bot and spam prevention</p>
          </div>
        </div>
      </section>

      <section id="create" className="create">
        <div className="section-title">
          <h2>Create a poll</h2>
          <p className="muted">Give it a clear question and options.</p>
        </div>
        <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Poll question</label>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should we build next?"
          />
        </div>

        <div className="field">
          <label>Options</label>
          <div className="options">
            {options.map((option, index) => (
              <div className="option-row" key={`option-${index}`}>
                <input
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= MIN_OPTIONS}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ghost"
            onClick={addOption}
            disabled={!canAddOption}
          >
            Add option
          </button>
        </div>

        <div className="field">
          <label>Poll closes at (optional)</label>
          <p className="field-hint">Set when voting should stop, or leave blank for no expiration</p>
          <div className="expiration-grid">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              placeholder="No expiration"
            />
            <div className="preset-buttons">
              <button type="button" className="preset-btn" onClick={() => setExpirationPreset(1)}>1 hour</button>
              <button type="button" className="preset-btn" onClick={() => setExpirationPreset(24)}>1 day</button>
              <button type="button" className="preset-btn" onClick={() => setExpirationPreset(168)}>1 week</button>
              {expiresAt && <button type="button" className="preset-btn" onClick={() => setExpiresAt("")}>Clear</button>}
            </div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create poll"}
          </button>
        </form>
      </section>

      {pollLink && (
        <div className="share">
          <p className="lead">Your poll is live.</p>
          <div className="share-row">
            <input value={pollLink} readOnly />
            <button className="primary" type="button" onClick={copyLink}>
              Copy link
            </button>
          </div>
          <a href={pollLink}>Open poll</a>
        </div>
      )}

      <section id="recent" className="recent">
        <div className="recent-header">
          <h2>Recent polls</h2>
          <span className="muted">{recentPolls.length} listed</span>
        </div>
        {recentPolls.length === 0 ? (
          <p className="muted">No polls yet. Create the first one.</p>
        ) : (
          <div className="recent-grid">
            {recentPolls.map((poll) => {
              const isExpired = poll.expires_at && new Date(poll.expires_at) < new Date();
              return (
                <a
                  key={poll.id}
                  className="recent-card"
                  href={`/poll/${poll.id}`}
                >
                  <p className="recent-title">{poll.question}</p>
                  <p className="muted">
                    Created {new Date(poll.created_at).toLocaleString()}
                  </p>
                  <p className="muted">
                    {poll.total_votes ?? 0} votes
                  </p>
                  {poll.expires_at && (
                    <p className={`muted ${isExpired ? 'expired-text' : ''}`}>
                      {isExpired ? '🔒 Closed' : `Closes ${new Date(poll.expires_at).toLocaleString()}`}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
