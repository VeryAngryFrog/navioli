#!/usr/bin/env python3
"""Tiny server for the Navioli shelf management.

Start:  python3 server.py   ->   http://localhost:8000
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "supermarket_db.json")
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "application/javascript; charset=utf-8"),
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/db":
            with open(DB, encoding="utf-8") as f:
                return self._send(200, f.read())
        if self.path in STATIC:
            name, ctype = STATIC[self.path]
            with open(os.path.join(BASE, name), "rb") as f:
                return self._send(200, f.read(), ctype)
        self._send(404, '{"error":"not found"}')

    def do_POST(self):
        if self.path != "/api/db":
            return self._send(404, '{"error":"not found"}')
        length = int(self.headers.get("Content-Length", 0))
        payload = self.rfile.read(length)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return self._send(400, '{"error":"invalid json"}')
        
        # Write atomically so the DB is never half-written.
        tmp = DB + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, DB)
        self._send(200, '{"status":"ok"}')

    def log_message(self, *args):
        pass  # quiet log


if __name__ == "__main__":
    port = 8000
    print(f"Navioli shelf management running on http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
