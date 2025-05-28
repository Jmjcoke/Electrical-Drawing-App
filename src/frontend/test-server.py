#!/usr/bin/env python3
import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Change to the Next.js build output directory
os.chdir('out')

PORT = 8080
HOST = '0.0.0.0'

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

print(f"Starting simple HTTP server...")
print(f"Server will be available at:")
print(f"  http://localhost:{PORT}")
print(f"  http://127.0.0.1:{PORT}")
print(f"  http://0.0.0.0:{PORT}")
print()
print("Press Ctrl+C to stop the server")

try:
    with socketserver.TCPServer((HOST, PORT), CustomHTTPRequestHandler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server...")