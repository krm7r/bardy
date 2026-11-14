function json404() {
  return new Response(JSON.stringify({ success: false, error: "Invalid API path" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function onRequest() {
  return json404();
}
