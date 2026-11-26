import {
  onRequest as proxyRequest,
  onRequestGet as proxyGet,
  onRequestOptions as proxyOptions,
} from "../api/worker/[[path]].js";

const params = { path: ["app", "calc"] };

export function onRequestGet(context) {
  return proxyGet({ ...context, params });
}

export function onRequestOptions(context) {
  return proxyOptions(context);
}

export function onRequest(context) {
  return proxyRequest(context);
}
