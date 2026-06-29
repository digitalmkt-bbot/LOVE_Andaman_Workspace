#!/bin/bash
# ============================================================
#  LOVE Andaman - Local Server Launcher
#  Double-click this file to start the server.
# ============================================================
cd "$(dirname "$0")"

echo "============================================================"
echo "   LOVE Andaman - Local Server"
echo "============================================================"
echo ""
echo "   Open Chrome to this address:"
echo ""
echo "      http://localhost:8765/allotment_v2.html"
echo ""
echo "   Keep THIS window open while using the app."
echo "   Close this window to stop the server."
echo "============================================================"
echo ""

# Try several web servers - use whichever the Mac already has.
if ruby --version >/dev/null 2>&1; then
  echo "Starting server with Ruby ..."
  echo ""
  ruby -run -e httpd . -p 8765
elif python3 --version >/dev/null 2>&1; then
  echo "Starting server with Python 3 ..."
  echo ""
  python3 -m http.server 8765
elif python --version >/dev/null 2>&1; then
  echo "Starting server with Python 2 ..."
  echo ""
  python -m SimpleHTTPServer 8765
else
  echo "------------------------------------------------------------"
  echo "  Could not find a built-in web server on this Mac."
  echo ""
  echo "  Easiest fix: install the developer tools."
  echo "  Run this command in Terminal, then double-click this"
  echo "  file again:"
  echo ""
  echo "      xcode-select --install"
  echo ""
  echo "  Or tell Claude - it can suggest another method."
  echo "------------------------------------------------------------"
  echo ""
  echo "Press any key to close this window..."
  read -n 1
fi
