export function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  json(res, 405, { ok: false, error: "method-not-allowed" });
  return false;
}

export function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("body-too-large"));
        queueMicrotask(() => req.destroy());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolveBody({});
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

export function queryOf(req) {
  try {
    return new URL(req.url ?? "/", "http://canvas.local").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export function getRoute(path, run) {
  return {
    kind: "exact",
    path,
    handler(req, res) {
      if (!requireMethod(req, res, "GET")) return;
      Promise.resolve()
        .then(run)
        .then(
          (value) => json(res, 200, value),
          (error) => json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
    },
  };
}

export function postRoute(path, run, maxBytes = 256 * 1024) {
  return {
    kind: "exact",
    path,
    handler(req, res) {
      if (!requireMethod(req, res, "POST")) return Promise.resolve();
      return readJsonBody(req, maxBytes)
        .then((body) => run(typeof body === "object" && body !== null ? body : {}))
        .then((value) => json(res, 200, value))
        .catch((error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    },
  };
}
