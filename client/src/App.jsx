
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function App() {
  const [sessions, setSessions] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [clicks, setClicks] = useState([]);
  const [view, setView] = useState("sessions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOverview() {
    const [sessionResponse, pageResponse] = await Promise.all([
      fetch(`${API}/sessions`),
      fetch(`${API}/pages`),
    ]);

    if (!sessionResponse.ok || !pageResponse.ok) {
      throw new Error("Could not load analytics data.");
    }

    const [sessionData, pageData] = await Promise.all([
      sessionResponse.json(),
      pageResponse.json(),
    ]);

    setSessions(sessionData);
    setPages(pageData);

    setSelectedSession((current) =>
      sessionData.some((s) => s.session_id === current)
        ? current
        : sessionData[0]?.session_id || ""
    );

    setSelectedPage((current) =>
      pageData.includes(current) ? current : pageData[0] || ""
    );
  }

  useEffect(() => {
    loadOverview()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSession) {
      setEvents([]);
      return;
    }

    let cancelled = false;

    fetch(
      `${API}/sessions/${encodeURIComponent(selectedSession)}/events`
    )
      .then((response) => {
        if (!response.ok) throw new Error("Could not load session events.");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedPage) {
      setClicks([]);
      return;
    }

    let cancelled = false;

    fetch(`${API}/events/clicks?pageUrl=${encodeURIComponent(selectedPage)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load click data.");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setClicks(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPage]);

  const totalEvents = sessions.reduce(
    (sum, session) => sum + session.total_events,
    0
  );

  const totalPageViews = sessions.reduce(
    (sum, session) => sum + session.page_views,
    0
  );

  const totalClicks = sessions.reduce(
    (sum, session) => sum + session.clicks,
    0
  );

  if (loading) {
    return <main className="loading">Loading analytics...</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <strong>CausalFunnel</strong>
            <span>Analytics</span>
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <button
          className={`nav-item ${view === "sessions" ? "active" : ""}`}
          onClick={() => setView("sessions")}
        >
          <span>◫</span> Sessions
        </button>

        <button
          className={`nav-item ${view === "heatmap" ? "active" : ""}`}
          onClick={() => setView("heatmap")}
        >
          <span>◉</span> Click heatmap
        </button>

        <div className="sidebar-footer">
          <span className="status-dot" />
          API connected
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ANALYTICS WORKSPACE</p>
            <h1>
              {view === "sessions" ? "User sessions" : "Click heatmap"}
            </h1>
            <p className="subtitle">
              Understand how visitors interact with your website.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={() => {
              setError("");
              setLoading(true);
              loadOverview()
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
          >
            ↻ Refresh data
          </button>
        </header>

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className="stats-grid">
          <StatCard
            label="Total sessions"
            value={sessions.length}
            icon="◎"
          />
          <StatCard label="Total events" value={totalEvents} icon="↗" />
          <StatCard label="Page views" value={totalPageViews} icon="▤" />
          <StatCard label="Clicks" value={totalClicks} icon="⌁" />
        </section>

        {view === "sessions" ? (
          <section className="panel sessions-panel">
            <div className="panel-heading">
              <div>
                <h2>Session explorer</h2>
                <p>Select a session to inspect its user journey.</p>
              </div>
              <span className="count-badge">
                {sessions.length} sessions
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="empty-state">
                <h3>No sessions yet</h3>
                <p>
                  Open your demo webpage and interact with it to generate
                  tracking events.
                </p>
              </div>
            ) : (
              <div className="session-layout">
                <div className="session-list">
                  {sessions.map((session) => (
                    <button
                      key={session.session_id}
                      className={`session-item ${
                        selectedSession === session.session_id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedSession(session.session_id)
                      }
                    >
                      <span className="session-avatar">U</span>
                      <span className="session-info">
                        <strong>
                          {session.session_id.slice(0, 19)}
                          {session.session_id.length > 19 ? "…" : ""}
                        </strong>
                        <small>
                          {formatDate(session.last_event_at)}
                        </small>
                      </span>
                      <span className="event-count">
                        {session.total_events}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="journey">
                  <div className="journey-heading">
                    <div>
                      <h3>User journey</h3>
                      <p>
                        {selectedSession
                          ? `${events.length} recorded events`
                          : "Choose a session"}
                      </p>
                    </div>
                  </div>

                  {events.length === 0 ? (
                    <div className="empty-state">
                      No events recorded for this session.
                    </div>
                  ) : (
                    <div className="timeline">
                      {events.map((event) => (
                        <div className="timeline-item" key={event._id}>
                          <div
                            className={`event-marker ${event.event_type}`}
                          >
                            {event.event_type === "page_view" ? "↗" : "•"}
                          </div>

                          <div className="event-details">
                            <div className="event-title-row">
                              <strong>
                                {event.event_type === "page_view"
                                  ? "Page view"
                                  : "Click"}
                              </strong>
                              <time>{formatDate(event.timestamp)}</time>
                            </div>

                            <p className="event-url">{event.page_url}</p>

                            {event.event_type === "click" && (
                              <span className="coordinates">
                                Position: ({event.click_x}, {event.click_y})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="panel heatmap-panel">
            <div className="panel-heading">
              <div>
                <h2>Click distribution</h2>
                <p>Explore where visitors click on a tracked page.</p>
              </div>
              <span className="count-badge">
                {clicks.length} clicks
              </span>
            </div>

            <label className="select-label" htmlFor="page-select">
              Select page URL
            </label>

            <select
              id="page-select"
              value={selectedPage}
              onChange={(event) => setSelectedPage(event.target.value)}
            >
              {pages.length === 0 && (
                <option value="">No tracked pages</option>
              )}
              {pages.map((page) => (
                <option value={page} key={page}>
                  {page}
                </option>
              ))}
            </select>

            <div className="heatmap-summary">
              <div>
                <strong>{clicks.length}</strong>
                <span>Recorded clicks</span>
              </div>
              <div>
                <strong>{new Set(clicks.map((c) => c.session_id)).size}</strong>
                <span>Sessions represented</span>
              </div>
            </div>

            <div className="heatmap-container">
              <div className="heatmap-label">
                <span>Viewport coordinate map</span>
                <span>Relative positions</span>
              </div>

              <div className="heatmap-canvas">
                {clicks.map((click, index) => {
                  const width = click.viewport_width;
                  const height = click.viewport_height;

                  // Without viewport dimensions, exact normalization
                  // is not possible, so use a reasonable visual fallback.
                  const left = width
                    ? (click.click_x / width) * 100
                    : Math.min((click.click_x / 1200) * 100, 100);

                  const top = height
                    ? (click.click_y / height) * 100
                    : Math.min((click.click_y / 800) * 100, 100);

                  return (
                    <span
                      key={`${click.session_id}-${click.timestamp}-${index}`}
                      className="heat-dot"
                      title={`Click at (${click.click_x}, ${click.click_y})`}
                      style={{
                        left: `${Math.max(0, Math.min(left, 100))}%`,
                        top: `${Math.max(0, Math.min(top, 100))}%`,
                      }}
                    />
                  );
                })}

                {clicks.length === 0 && (
                  <p className="heatmap-empty">
                    No click events for this page yet.
                  </p>
                )}
              </div>

              <p className="heatmap-note">
                Each dot represents one click. This view plots normalized
                viewport coordinates, not a screenshot of the original page.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
