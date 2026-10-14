
(function () {
  const API_URL = "/tracker-api/events";
  const SESSION_KEY = "causalfunnel_session_id";

  // Reuse the same session ID across page reloads.
  function getSessionId() {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
  }

  const sessionId = getSessionId();

  // Send one event to the backend.
  function trackEvent(eventType, clickData = {}) {
    const event = {
      session_id: sessionId,
      event_type: eventType,
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
      ...clickData,
    };

    fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch((error) => {
      console.error("Analytics tracking failed:", error);
    });
  }

  // Record the initial page view.
  trackEvent("page_view");

  // Record clicks anywhere on the page.
  document.addEventListener("click", function (event) {
    trackEvent("click", {
      click_x: event.clientX,
      click_y: event.clientY,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    });
  });

  console.log("CausalFunnel tracker initialized:", sessionId);
})();
