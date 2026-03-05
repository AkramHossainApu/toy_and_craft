import http.server
import socketserver
import os
import sys

# Serve SPA and forward other requests appropriately.
class SPANotFoundRedirectHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path)
        
        # If the file/dir doesn't exist and not obviously an asset, serve index
        if not os.path.exists(path) and "." not in self.path.split('/')[-1]:
            self.path = '/index.html'

        return super().do_GET()

if __name__ == '__main__':
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with socketserver.TCPServer(("", PORT), SPANotFoundRedirectHandler) as httpd:
        print(f"Test SPA Server running on port {PORT}. ")
        httpd.serve_forever()
