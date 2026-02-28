import http.server
import socketserver
import os

PORT = 8000

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Translate the requested URL path to an OS path
        path = self.translate_path(self.path)
        
        # If the file doesn't exist (and it's not a direct file request like .css),
        # serve index.html to allow the Single Page App (JS) to handle the route.
        if not os.path.exists(path) and '.' not in self.path:
            self.path = '/index.html'

        return super().do_GET()

with socketserver.TCPServer(("", PORT), SPARequestHandler) as httpd:
    print(f"SPA Server running on port {PORT}. Press Ctrl+C to stop.")
    print("This server automatically redirects 404 paths to index.html for Single-Page Apps.")
    httpd.serve_forever()
