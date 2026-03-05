import http.server
import socketserver
import urllib.request
import os

PORT = 8000

class SPA_Proxy(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # We handle all logic here.
        # Check if the requested path corresponds to an actual file.
        path = self.translate_path(self.path)
        
        # If the file does not exist, AND there is no file extension (meaning it's unlikely to be a static file request like .css/.js)
        # we reroute the request to index.html to allow the client-side SPA router to take over.
        if not os.path.exists(path) and "." not in self.path.split('/')[-1]:
            self.path = '/index.html'

        return super().do_GET()

with socketserver.TCPServer(("", PORT), SPA_Proxy) as httpd:
    print(f"SPA Server running on port {PORT}. Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
