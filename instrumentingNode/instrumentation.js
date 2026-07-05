// ============================================================
// instrumentation.js — AUTO-INSTRUMENTATION with OpenTelemetry
// ============================================================
// This file MUST be loaded BEFORE your application code.
// It automatically instruments popular Node.js libraries
// (Express, HTTP, DNS, fs, etc.) without you writing any
// tracing code inside your route handlers.
//
// Run with:  node --require ./instrumentation.js app.js
// ============================================================

const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require("@opentelemetry/semantic-conventions");

// ── Load env vars ──────────────────────────────────────────
require("dotenv").config();

const AXIOM_API_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET || "otel-node-demo";

if (!AXIOM_API_TOKEN) {
  console.warn(
    "⚠️  AXIOM_API_TOKEN is not set — traces will NOT be exported to Axiom."
  );
}

// ── Configure the OTLP exporter pointing at Axiom ─────────
const traceExporter = new OTLPTraceExporter({
  url: "https://api.axiom.co/v1/traces",
  headers: {
    Authorization: `Bearer ${AXIOM_API_TOKEN}`,
    "X-Axiom-Dataset": AXIOM_DATASET,
  },
});

// ── Initialize the OpenTelemetry Node SDK ──────────────────
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "node-otel-demo",
    [ATTR_SERVICE_VERSION]: "1.0.0",
  }),
  traceExporter,

  // This single call auto-instruments ALL supported libraries:
  //   • @opentelemetry/instrumentation-http     (incoming & outgoing HTTP)
  //   • @opentelemetry/instrumentation-express  (Express middleware & routes)
  //   • @opentelemetry/instrumentation-dns      (DNS lookups)
  //   • @opentelemetry/instrumentation-fs       (file-system ops)
  //   • … and many more
  instrumentations: [
    getNodeAutoInstrumentations({
      // You can disable noisy instrumentations you don't need:
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();
console.log("✅ OpenTelemetry auto-instrumentation initialized");
console.log(`   → Exporting traces to Axiom dataset: "${AXIOM_DATASET}"`);

// Graceful shutdown — flush pending spans on exit
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OpenTelemetry SDK shut down"))
    .catch((err) => console.error("Error shutting down SDK", err))
    .finally(() => process.exit(0));
});
