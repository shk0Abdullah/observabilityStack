// ============================================================
// app.js — Simple Express app demonstrating BOTH
//          auto-instrumentation AND manual instrumentation
// ============================================================

const express = require("express");
const { withSpan, tracer } = require("./tracing");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ──────────────────────────────────────────────────────────
//  ROUTE 1:  GET /
//  This is AUTO-INSTRUMENTED — you don't need to do anything.
//  OpenTelemetry's Express instrumentation automatically
//  creates spans for every incoming HTTP request.
// ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Node + OpenTelemetry + Axiom Demo",
    routes: {
      "GET /":           "This info (auto-instrumented)",
      "GET /users":      "Simulated DB fetch (manual span)",
      "GET /users/:id":  "Single user lookup (manual span)",
      "POST /orders":    "Multi-step order processing (manual spans)",
      "GET /external":   "Outgoing HTTP call (auto-instrumented)",
      "GET /error":      "Throws an error (captured in span)",
    },
  });
});

// ──────────────────────────────────────────────────────────
//  ROUTE 2:  GET /users
//  Demonstrates MANUAL instrumentation — we wrap the
//  "database query" in a custom span so we can see the
//  query time, the result count, etc. in Axiom.
// ──────────────────────────────────────────────────────────
app.get("/users", async (req, res) => {
  const users = await withSpan("db.queryAllUsers", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.statement", "SELECT * FROM users");

    // Simulate a database call with a random delay
    const delay = Math.floor(Math.random() * 200) + 50;
    await sleep(delay);

    const result = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Charlie", email: "charlie@example.com" },
    ];

    span.setAttribute("db.result.count", result.length);
    span.addEvent("query_completed", { "query.duration_ms": delay });

    return result;
  });

  res.json(users);
});

// ──────────────────────────────────────────────────────────
//  ROUTE 3:  GET /users/:id
//  Manual span with dynamic attributes from the request.
// ──────────────────────────────────────────────────────────
app.get("/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  const user = await withSpan("db.findUserById", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.statement", `SELECT * FROM users WHERE id = $1`);
    span.setAttribute("user.id", userId);

    await sleep(Math.floor(Math.random() * 100) + 30);

    if (userId > 3 || userId < 1) {
      span.addEvent("user_not_found", { "user.id": userId });
      return null;
    }

    return { id: userId, name: `User_${userId}`, email: `user${userId}@example.com` };
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

// ──────────────────────────────────────────────────────────
//  ROUTE 4:  POST /orders
//  Shows NESTED manual spans — each step of the order
//  processing pipeline gets its own child span, giving
//  you a beautiful waterfall trace in Axiom.
// ──────────────────────────────────────────────────────────
app.post("/orders", async (req, res) => {
  const order = await withSpan("order.process", async (parentSpan) => {
    const orderId = `ORD-${Date.now()}`;
    parentSpan.setAttribute("order.id", orderId);

    // Step 1: Validate the order
    await withSpan("order.validate", async (span) => {
      span.setAttribute("order.id", orderId);
      await sleep(50);
      span.addEvent("validation_passed");
    });

    // Step 2: Check inventory
    await withSpan("inventory.check", async (span) => {
      span.setAttribute("order.id", orderId);
      span.setAttribute("inventory.warehouse", "US-EAST-1");
      await sleep(80);
      span.addEvent("inventory_available", { "items.count": 3 });
    });

    // Step 3: Process payment
    await withSpan("payment.process", async (span) => {
      span.setAttribute("order.id", orderId);
      span.setAttribute("payment.method", "credit_card");
      span.setAttribute("payment.amount", 99.99);
      await sleep(150);
      span.addEvent("payment_authorized");
    });

    // Step 4: Create shipment
    await withSpan("shipment.create", async (span) => {
      span.setAttribute("order.id", orderId);
      span.setAttribute("shipment.carrier", "FedEx");
      await sleep(60);
      span.addEvent("shipment_created");
    });

    parentSpan.addEvent("order_completed");
    return { orderId, status: "completed", total: 99.99 };
  });

  res.status(201).json(order);
});

// ──────────────────────────────────────────────────────────
//  ROUTE 5:  GET /external
//  Makes an outgoing HTTP request — this is AUTO-INSTRUMENTED
//  by @opentelemetry/instrumentation-http. The SDK
//  automatically creates a span for the outgoing fetch call.
// ──────────────────────────────────────────────────────────
app.get("/external", async (req, res) => {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
    const data = await response.json();
    res.json({ source: "jsonplaceholder", data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch external data" });
  }
});

// ──────────────────────────────────────────────────────────
//  ROUTE 6:  GET /error
//  Demonstrates how errors are captured in spans.
//  The auto-instrumentation will mark the HTTP span as
//  ERROR, and our manual withSpan wrapper records the
//  exception on the span.
// ──────────────────────────────────────────────────────────
app.get("/error", async (req, res) => {
  try {
    await withSpan("dangerousOperation", async (span) => {
      span.setAttribute("operation.type", "risky");
      await sleep(30);
      throw new Error("💥 Something went terribly wrong!");
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helper ─────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌍 Server running at http://localhost:${PORT}`);
  console.log(`   Hit the routes to generate traces!\n`);
});
