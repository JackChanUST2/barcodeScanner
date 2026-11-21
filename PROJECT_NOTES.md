# Barcode Scanner Project Notes

## 1) Project Overview
This project is a browser-based barcode scanner web app for mobile and desktop users.
It provides:
- Camera-driven barcode detection in the browser.
- User-controlled barcode registration to shared history.
- Manual barcode entry fallback.
- CSV and XLSX export of scan history.

The application is designed for shared usage, where multiple users/devices can view and append to the same scan list stored in SQLite.

## 2) Runtime Architecture
High-level architecture:
- Backend: Flask application serving HTML and JSON APIs.
- Frontend: Single-page style UI with vanilla JavaScript and CSS.
- Database: SQLite file in project root.
- Hosting: Render using Gunicorn/WGI entrypoint.

Component responsibilities:
- Backend handles persistence, validation, and API responses.
- Frontend handles camera access, ZXing decoding, UI state, and API calls.
- SQLite stores the canonical scan list for all clients.

## 3) Repository Structure
Current workspace layout:

- app.py
  - Flask app creation, routes, DB init, API handlers.
- wsgi.py
  - WSGI import target for production server.
- requirements.txt
  - Python dependencies.
- render.yaml
  - Render service definition/configuration.
- templates/index.html
  - Main scanner page markup and external script includes.
- static/script.js
  - Frontend logic: camera lifecycle, scan workflow, API integration, export logic.
- static/styles.css
  - UI styles and responsive behavior.
- PROJECT_NOTES.md
  - Internal engineering notes (this file).
- README.md
  - Setup and usage instructions.

## 4) Backend Details
Main backend file: app.py

Database setup:
- DB path is resolved from project root to barcode_scans.db.
- init_db creates table scans if missing.
- scans schema:
  - id INTEGER PRIMARY KEY AUTOINCREMENT
  - barcode TEXT NOT NULL
  - created_at TEXT NOT NULL

Routes:
- GET /
  - Renders templates/index.html.
- GET /api/scans
  - Returns all scans as JSON, newest first (ORDER BY id DESC).
- POST /api/scans
  - Accepts JSON payload with barcode.
  - Validates non-empty value.
  - Inserts row and returns created record fields.
- GET /health
  - Basic health endpoint returning status ok.

Timestamp behavior:
- created_at uses UTC formatted as DD/MM/YYYY HH:MM:SS.

## 5) Frontend Details
Main frontend file: static/script.js

Key runtime state:
- codeReader: ZXing reader instance.
- stream: MediaStream from getUserMedia.
- scannerControls: handle returned by continuous decode session.
- latestDetectedCode: most recent valid decoded barcode detected by camera.
- scanLock: prevents overlapping save operations.
- cameraReady: indicates camera/video is initialized.
- scanHistory: cached backend scan list for rendering/export.

UI bindings:
- Video element for camera preview.
- Buttons: Start Camera, Scan Barcode, Stop, Save Manual, Export CSV, Export Excel.
- Status and debug text fields.
- Latest scan box and scan history table.

External browser libraries:
- ZXing via CDN for barcode decoding.
- SheetJS (xlsx) via CDN for CSV/XLSX export.

## 6) Camera and Scan Behavior (Current Logic)
The current expected behavior is:

1. Start Camera
- Requests camera permission and starts video preview.
- Starts continuous ZXing decode loop in background.
- Background loop keeps searching for barcodes continuously.
- Detected results update latestDetectedCode only (internal cache).

2. Scan Barcode
- Requires camera to be active and search loop to be running.
- Reads latestDetectedCode (last valid detected value).
- Immediately updates Latest scan UI box from that value.
- Sends that value to backend via POST /api/scans.
- Refreshes shared history after successful save.
- Keeps camera/search loop running after save.

3. Stop
- Stops continuous decode controls.
- Resets reader state.
- Stops all camera tracks.
- Clears video srcObject and marks camera not ready.

Important distinction:
- Detection is continuous.
- Registration is user-triggered by pressing Scan Barcode.
- Latest scan UI is updated on Scan Barcode action path, not on passive detection.

## 7) Data and API Flow
Flow for camera-based registration:
- Browser detects barcode continuously.
- User presses Scan Barcode.
- Frontend posts barcode to /api/scans.
- Backend stores row in SQLite.
- Frontend reloads /api/scans and rerenders history.

Flow for manual entry:
- User enters value.
- Frontend normalizes/removes whitespace and validates allowed characters.
- Frontend posts to /api/scans.
- History reloads and rerenders.

## 8) Export Behavior
Exports are based on in-memory scanHistory (already loaded from backend):
- CSV export: builds sheet data then converts to CSV.
- XLSX export: creates workbook and downloads .xlsx file.

If no scans exist, export buttons report no data to export.

## 9) Local Development
Typical commands:
- Install dependencies:
  - python -m pip install -r requirements.txt
- Run app locally:
  - python app.py
- Verify routes quickly:
  - python -c "from app import app; print(sorted(str(rule) for rule in app.url_map.iter_rules()))"

Local URL:
- http://localhost:5000

For phone testing on same network:
- http://<computer-ip>:5000

## 10) Deployment Notes (Render)
- Deploy from main branch.
- Use WSGI app target compatible with wsgi.py.
- Keep dependencies in requirements.txt aligned with runtime imports.
- Health endpoint is available at /health.

## 11) Operational Notes and Guardrails
- Camera access depends on browser permission and secure context constraints.
- scanLock prevents overlapping save requests from repeated button presses.
- Error/status text is intentionally user-readable with extra debug text for troubleshooting.

## 12) Suggested Future Improvements
- Add duplicate suppression window (optional) to avoid repeated saves of same barcode in rapid sequence.
- Add unit/integration tests for API handlers and payload validation.
- Add lightweight frontend integration tests for button state transitions.
- Add pagination or cap for history table if scan volume grows.
