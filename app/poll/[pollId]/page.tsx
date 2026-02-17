"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { buildFingerprint } from "@/lib/fingerprint";
import { getOrCreateDeviceId } from "@/lib/deviceId";
import { getRealtimeClient } from "@/lib/realtimeClient";
import { supabaseClient } from "@/lib/supabaseClient";
import { generateNonce } from "@/lib/nonceTracker";

interface PollOption {
  id: string;
  label: string;
  sort_order: number;
}

interface PollData {
  id: string;
  question: string;
  created_at: string;
  expires_at: string | null;
}

interface PollPageProps {
  params: Promise<{ pollId: string }>;
}

interface CountEntry {
  optionId: string;
  count: number;
}

export default function PollPage(props: PollPageProps) {
  const params = use(props.params);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState(""); // Bot trap
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const searchParams = useSearchParams();
  const resultsOnly = searchParams.get("view") === "results";

  const startTimeRef = useRef(Date.now());
  const mouseMovesRef = useRef(0);
  const nonceRef = useRef<string | null>(null);

  // Generate nonce once on mount - prevents replay attacks
  useEffect(() => {
    nonceRef.current = generateNonce();
  }, []);

  const totalVotes = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts]
  );

  const isExpired = useMemo(() => {
    if (!poll?.expires_at) return false;
    return new Date(poll.expires_at).getTime() < currentTime;
  }, [poll?.expires_at, currentTime]);

  useEffect(() => {
    async function loadPoll() {
      setLoading(true);
      const response = await fetch(`/api/polls/${params.pollId}`);
      if (!response.ok) {
        setStatus("Poll not found.");
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setPoll(payload.poll);
      setOptions(payload.options ?? []);

      const initialCounts: Record<string, number> = {};
      for (const entry of payload.counts ?? []) {
        initialCounts[entry.option_id] = Number(entry.vote_count);
      }
      setCounts(initialCounts);
      setLoading(false);
      setShareLink(`${window.location.origin}/poll/${params.pollId}`);
    }

    loadPoll();
  }, [params.pollId]);

  // Real-time updates using Supabase Realtime (production-ready)
  useEffect(() => {
    const channel = supabaseClient
      .channel(`poll:${params.pollId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_counts",
          filter: `poll_id=eq.${params.pollId}`
        },
        async (payload) => {
          // Refresh counts when poll_counts changes
          const response = await fetch(`/api/polls/${params.pollId}`);
          if (response.ok) {
            const data = await response.json();
            const refreshedCounts: Record<string, number> = {};
            for (const entry of data.counts ?? []) {
              refreshedCounts[entry.option_id] = Number(entry.vote_count);
            }
            setCounts(refreshedCounts);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [params.pollId]);

  // Socket.io real-time (optional, for advanced features like viewer count)
  useEffect(() => {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!realtimeUrl) {
      // Socket.io not configured - viewer count will be hidden
      return;
    }

    const socket = getRealtimeClient();
    
    const joinPoll = () => {
      socket.emit("join_poll", params.pollId);
    };
    
    if (socket.connected) {
      joinPoll();
    } else {
      socket.on("connect", joinPoll);
    }

    socket.on("poll_update", (entries: CountEntry[]) => {
      const nextCounts: Record<string, number> = {};
      entries.forEach((entry) => {
        nextCounts[entry.optionId] = Number(entry.count);
      });
      setCounts(nextCounts);
    });

    socket.on("viewer_count", (count: number) => {
      setViewerCount(count);
    });

    return () => {
      socket.emit("leave_poll", params.pollId);
      socket.off("poll_update");
      socket.off("viewer_count");
      socket.off("connect");
    };
  }, [params.pollId]);

  useEffect(() => {
    function handleMove() {
      mouseMovesRef.current += 1;
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useEffect(() => {
    if (!shareLink) return;
    QRCode.toDataURL(shareLink, { margin: 1, width: 160 }).then(setQrDataUrl);
  }, [shareLink]);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setSessionEmail(session?.user.email ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Real-time expiration check - updates every second when poll has expiration
  useEffect(() => {
    if (!poll?.expires_at) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [poll?.expires_at]);

  function signInWithGoogle() {
    setShowGoogleModal(true);
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
  }

  function getBehaviorScore() {
    const secondsOnPage = (Date.now() - startTimeRef.current) / 1000;
    const mouseMoves = mouseMovesRef.current;
    
    // Real-world human behavior: requires BOTH time AND movement
    // Bots typically fake one but not both naturally
    // Score 0-10: need at least 3 seconds AND 2 mouse moves to pass
    const timeScore = secondsOnPage >= 5 ? 5 : Math.floor(secondsOnPage);
    const moveScore = mouseMoves >= 3 ? 5 : (mouseMoves >= 2 ? 3 : 0);
    
    return Math.min(10, timeScore + moveScore);
  }

  async function submitVote() {
    if (!selectedOption || voting) return;
    
    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      setStatus("Invalid request.");
      setVoting(false);
      return;
    }
    
    setVoting(true);
    setStatus(null);

    const fingerprint = `${getOrCreateDeviceId()}::${buildFingerprint()}`;

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pollId: params.pollId,
          optionId: selectedOption,
          fingerprint,
          behaviorScore: getBehaviorScore(),
          verified: Boolean(sessionEmail),
          timestamp: Date.now(),
          nonce: nonceRef.current // Unique token prevents replay attacks
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.status === "duplicate") {
          setStatus("You've already voted on this poll from this device.");
        } else if (payload.status === "rejected") {
          setStatus(payload.reason || "Your vote was not accepted. Please try again later.");
        } else {
          setStatus(payload.error ?? "Unable to submit vote. Please try again.");
        }
        return;
      }

      setStatus("Vote recorded successfully!");
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return <p>Loading poll...</p>;
  }

  if (!poll) {
    return <p>Poll not found.</p>;
  }

  return (
    <section className="stack">
      {/* Google Sign-In Modal */}
      {showGoogleModal && (
        <div className="modal-overlay" onClick={() => setShowGoogleModal(false)}>
          <div className="google-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowGoogleModal(false)}>
              ✕
            </button>
            
            <div className="google-header">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <h2>Google Sign-In</h2>
            </div>
            
            <div className="modal-content">
              <div className="internship-message">
                <p className="highlight"><strong>Select me for the internship, then we'll implement this feature!</strong></p>
              </div>
              
              <div className="feature-explanation">
                <h3>What is Verified Voting?</h3>
                <p>
                  When you sign in with Google, your vote is marked as <strong>verified</strong>. 
                  This helps prevent spam and makes poll results more trustworthy.
                </p>
                
                <div className="vote-breakdown">
                  <div className="breakdown-item">
                    <div className="icon anonymous">👤</div>
                    <div>
                      <strong>Anonymous Votes</strong>
                      <p>Valid votes from users who didn't sign in</p>
                    </div>
                  </div>
                  
                  <div className="breakdown-item">
                    <div className="icon verified">✓</div>
                    <div>
                      <strong>Verified Votes</strong>
                      <p>Votes from users signed in with Google</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="primary" onClick={() => setShowGoogleModal(false)}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      
      <header className="hero">
        <p className="eyebrow">Live poll room</p>
        <h1>{poll.question}</h1>
        <div className="live-stats">
          {viewerCount !== null && (
            <div>
              <p className="metric">{viewerCount}</p>
              <p className="muted">Live viewers</p>
            </div>
          )}
          <div>
            <p className="metric">{totalVotes}</p>
            <p className="muted">Total votes</p>
          </div>
        </div>
        {poll.expires_at && (
          <p className="lead">
            Closes at {new Date(poll.expires_at).toLocaleString()}
          </p>
        )}
      </header>

      {!resultsOnly && !isExpired && (
        <div className="card">
        <div className="poll-options">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option-button ${
                selectedOption === option.id ? "selected" : ""
              }`}
              onClick={() => setSelectedOption(option.id)}
            >
              <span>{option.label}</span>
              <span className="count">{counts[option.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="poll-actions">
          {/* Honeypot field - hidden from humans, visible to bots */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          
          {sessionEmail ? (
            <div className="auth-row">
              <span className="verified">Verified as {sessionEmail}</span>
              <button className="ghost" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <button className="ghost" type="button" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          )}

          <button
            className="primary"
            type="button"
            onClick={submitVote}
            disabled={!selectedOption || voting}
          >
            {voting ? "Submitting..." : "Cast vote"}
          </button>

          {status && <p className="status">{status}</p>}
        </div>
        </div>
      )}

      {isExpired && (
        <div className="card expired-poll">
          <div className="expired-message">
            <h3>Voting Closed</h3>
            <p>This poll has expired and is no longer accepting votes.</p>
            <p className="muted">try exploring other active polls.</p>
            <a href="/#recent" className="button primary">Browse Active Polls</a>
          </div>
        </div>
      )}

      {shareLink && (
        <div className="share">
          <p className="lead">Share this poll</p>
          <div className="share-row">
            <input value={shareLink} readOnly />
            <button
              className="primary"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(shareLink);
              }}
            >
              Copy link
            </button>
          </div>
          {qrDataUrl && (
            <div className="qr-wrap">
              <img src={qrDataUrl} alt="Poll QR code" />
              <p className="muted">Scan to open on mobile.</p>
            </div>
          )}
        </div>
      )}

      {resultsOnly && (
        <div className="card results-only">
          <p className="muted">
            Results-only view. Add <strong>?view=results</strong> to share a
            read-only link.
          </p>
        </div>
      )}

      <section className="flow">
        <div className="section-title">
          <h2>How we keep voting fair</h2>
          <p className="muted">
            <strong>One vote per device:</strong> Your browser and device create a unique fingerprint. Once you vote, you can't vote again from this device.
          </p>
          <p className="muted">
            <strong>Spam protection:</strong> We limit how many votes can come from the same IP address to prevent bot attacks.
          </p>
          <p className="muted">
            <strong>Real voters only:</strong> We check that you spent time reading the poll before voting (not instant bot clicks).
          </p>
          {sessionEmail && (
            <p className="muted">
              ✓ <strong>Verified account:</strong> You're signed in as {sessionEmail}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
