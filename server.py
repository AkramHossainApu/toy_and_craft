import http.server
import socketserver
import os
import json
import urllib.request
import urllib.parse
import urllib.error
import ssl

# SSL context for macOS compatibility
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

PORT = 8000

# ─── Steadfast API Configuration ───────────────────────────────
STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1"
STEADFAST_API_KEY = "rwmg2vzo76tyjtmvshulai2fmyzkptg5"
STEADFAST_SECRET_KEY = "jfx9xbxf32nzczafqwdp8bo1"


def steadfast_request(method, path, data=None):
    """Make a request to the Steadfast API with auth headers."""
    url = STEADFAST_BASE_URL + path
    headers = {
        "Api-Key": STEADFAST_API_KEY,
        "Secret-Key": STEADFAST_SECRET_KEY,
        "Content-Type": "application/json",
    }

    if data and method == "POST":
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    else:
        req = urllib.request.Request(url, headers=headers, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            return json.loads(error_body), e.code
        except json.JSONDecodeError:
            return {"error": error_body}, e.code
    except urllib.error.URLError as e:
        return {"error": str(e.reason)}, 502
    except Exception as e:
        return {"error": str(e)}, 500


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'application/javascript',
        '.css': 'text/css',
    })

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # CORS for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_POST(self):
        """Handle POST requests for Steadfast API proxy."""

        # ── Create Order ──────────────────────────────────────
        if self.path == '/api/steadfast/create-order':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            try:
                payload = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            # Validate required fields
            required = ['invoice', 'recipient_name', 'recipient_phone', 'recipient_address', 'cod_amount']
            missing = [f for f in required if f not in payload]
            if missing:
                self.send_json({"error": f"Missing fields: {', '.join(missing)}"}, 400)
                return

            # Forward to Steadfast
            result, status = steadfast_request("POST", "/create_order", payload)
            self.send_json(result, status)
            return

        # Unknown POST
        self.send_json({"error": "Not found"}, 404)

    def do_GET(self):
        """Handle GET requests — Steadfast tracking + SPA fallback."""

        # ── Track by Invoice ID ───────────────────────────────
        if self.path.startswith('/api/steadfast/track/'):
            invoice_id = self.path.replace('/api/steadfast/track/', '').strip('/')
            if not invoice_id:
                self.send_json({"error": "Invoice ID required"}, 400)
                return

            result, status = steadfast_request("GET", f"/status_by_invoice/{urllib.parse.quote(invoice_id)}")
            self.send_json(result, status)
            return

        # ── Track by Tracking Code ────────────────────────────
        if self.path.startswith('/api/steadfast/track-by-code/'):
            code = self.path.replace('/api/steadfast/track-by-code/', '').strip('/')
            if not code:
                self.send_json({"error": "Tracking code required"}, 400)
                return

            result, status = steadfast_request("GET", f"/status_by_trackingcode/{urllib.parse.quote(code)}")
            self.send_json(result, status)
            return

        # ── Steadfast Balance ─────────────────────────────────
        if self.path == '/api/steadfast/balance':
            result, status = steadfast_request("GET", "/get_balance")
            self.send_json(result, status)
            return

        # ── SPA Fallback ──────────────────────────────────────
        path = self.translate_path(self.path)
        if not os.path.exists(path) and '.' not in self.path:
            self.path = '/index.html'

        return super().do_GET()


class ReuseTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReuseTCPServer(("", PORT), SPARequestHandler) as httpd:
    print(f"🚀 Toy & Craft Server running on port {PORT}")
    print(f"   SPA routing:  http://localhost:{PORT}")
    print(f"   Steadfast API proxy active")
    print(f"   Press Ctrl+C to stop.")
    httpd.serve_forever()
