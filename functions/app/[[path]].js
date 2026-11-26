// Public app routes are served through the same protected proxy used by /api/worker/*.
// Keeping one implementation preserves validation, filtering, rate limiting, and LEEG bindings.
export {
  onRequest,
  onRequestGet,
  onRequestOptions,
} from "../api/worker/[[path]].js";
