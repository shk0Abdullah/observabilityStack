// ============================================================
// tracing.js — MANUAL INSTRUMENTATION helpers
// ============================================================
// Use this module when you want fine-grained control over
// what gets traced.  Auto-instrumentation handles library-level
// spans (HTTP requests, DB queries, etc.), but manual spans
// let you trace YOUR business logic specifically.
//
// Example:
//   const { withSpan } = require("./tracing");
//   const result = await withSpan("processOrder", async (span) => {
//       span.setAttribute("order.id", orderId);
//       // … your logic …
//       return result;
//   });
// ============================================================

const { trace, SpanStatusCode, context } = require("@opentelemetry/api");

// A single tracer for the whole app — name it after your service
const tracer = trace.getTracer("node-otel-demo", "1.0.0");

/**
 * Wrap an async function in a custom span.
 *
 * @param {string} spanName   – human-readable name for the span
 * @param {(span: import("@opentelemetry/api").Span) => Promise<T>} fn
 *        – the async work to trace; receives the span so you can
 *          add attributes / events
 * @returns {Promise<T>}
 */
async function withSpan(spanName, fn) {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a child span within the current context (synchronous version).
 */
function withSpanSync(spanName, fn) {
  return tracer.startActiveSpan(spanName, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { tracer, withSpan, withSpanSync };
