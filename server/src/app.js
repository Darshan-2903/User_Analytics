const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

let db;

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: db ? "connected" : "disconnected",
  });
});

// 2. Receive and store an event
app.post("/api/events", async (req, res) => {
  try {
    const {
      session_id,
      event_type,
      page_url,
      timestamp,
      click_x,
      click_y,
      viewport_width,
      viewport_height,
    } = req.body;

    if (
      typeof session_id !== "string" ||
      session_id.length < 1 ||
      session_id.length > 128 ||
      !["page_view", "click"].includes(event_type) ||
      !isValidUrl(page_url)
    ) {
      return res.status(400).json({
        error: "Invalid session_id, event_type, or page_url",
      });
    }

    const eventDate = new Date(timestamp);

    if (
      typeof timestamp !== "string" ||
      !Number.isFinite(eventDate.getTime())
    ) {
      return res.status(400).json({
        error: "A valid timestamp is required",
      });
    }

    const event = {
      session_id,
      event_type,
      page_url,
      timestamp: eventDate,
    };

    if (event_type === "click") {
      if (
        !Number.isFinite(click_x) ||
        !Number.isFinite(click_y) ||
        click_x < 0 ||
        click_y < 0
      ) {
        return res.status(400).json({
          error: "Valid click coordinates are required",
        });
      }

      event.click_x = click_x;
      event.click_y = click_y;

      if (
        Number.isFinite(viewport_width) &&
        Number.isFinite(viewport_height) &&
        viewport_width > 0 &&
        viewport_height > 0
      ) {
        event.viewport_width = viewport_width;
        event.viewport_height = viewport_height;
      }
    }

    const result = await db.collection("events").insertOne(event);

    res.status(201).json({
      message: "Event stored successfully",
      event_id: result.insertedId,
    });
  } catch (error) {
    console.error("Event ingestion failed:", error.message);
    res.status(500).json({ error: "Failed to store event" });
  }
});

// 3. Fetch sessions and event counts
app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await db.collection("events").aggregate([
      {
        $group: {
          _id: "$session_id",
          total_events: { $sum: 1 },
          page_views: {
            $sum: {
              $cond: [{ $eq: ["$event_type", "page_view"] }, 1, 0],
            },
          },
          clicks: {
            $sum: {
              $cond: [{ $eq: ["$event_type", "click"] }, 1, 0],
            },
          },
          last_event_at: { $max: "$timestamp" },
        },
      },
      { $sort: { last_event_at: -1 } },
      {
        $project: {
          _id: 0,
          session_id: "$_id",
          total_events: 1,
          page_views: 1,
          clicks: 1,
          last_event_at: 1,
        },
      },
    ]).toArray();

    res.json(sessions);
  } catch (error) {
    console.error("Session query failed:", error.message);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// 4. Fetch ordered events for one session
app.get("/api/sessions/:sessionId/events", async (req, res) => {
  try {
    const events = await db.collection("events")
      .find({ session_id: req.params.sessionId })
      .sort({ timestamp: 1, _id: 1 })
      .toArray();

    res.json(events);
  } catch (error) {
    console.error("Session events query failed:", error.message);
    res.status(500).json({ error: "Failed to fetch session events" });
  }
});


app.get("/api/pages", async (req, res) => {
  try {
    const pages = await db.collection("events").distinct("page_url");

    res.json(pages.sort());
  } catch (error) {
    console.error("Page query failed:", error.message);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// 5. Fetch click coordinates for a page
app.get("/api/events/clicks", async (req, res) => {
  try {
    const { pageUrl } = req.query;

    if (typeof pageUrl !== "string" || !isValidUrl(pageUrl)) {
      return res.status(400).json({
        error: "A valid pageUrl query parameter is required",
      });
    }

    const clicks = await db.collection("events")
      .find(
        { event_type: "click", page_url: pageUrl },
        {
          projection: {
            _id: 0,
            session_id: 1,
            timestamp: 1,
            click_x: 1,
            click_y: 1,
            viewport_width: 1,
            viewport_height: 1,
          },
        }
      )
      .sort({ timestamp: 1 })
      .toArray();

    res.json(clicks);
  } catch (error) {
    console.error("Click query failed:", error.message);
    res.status(500).json({ error: "Failed to fetch click data" });
  }
});

async function startServer() {
  const client = new MongoClient(process.env.MONGODB_URI);

  await client.connect();
  db = client.db();

  await db.collection("events").createIndex({
    session_id: 1,
    timestamp: 1,
  });

  await db.collection("events").createIndex({
    page_url: 1,
    event_type: 1,
  });

  console.log("Connected to MongoDB successfully");

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
