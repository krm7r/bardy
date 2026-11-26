import {
  onRequest as proxyRequest,
  onRequestGet as proxyGet,
  onRequestOptions as proxyOptions,
} from "../api/worker/[[path]].js";

function appParams(request) {
  const pathname = new URL(request.url).pathname.replace(/^\/app\/?/, "");
  return { path: pathname.split("/").filter(Boolean) };
}

export async function onRequestGet(context) {
  return proxyGet({ ...context, params: appParams(context.request) });
}

export async function onRequestOptions(context) {
  return proxyOptions(context);
}

export async function onRequest(context) {
  return proxyRequest(context);
}
