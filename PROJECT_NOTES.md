# Barcode Scanner Project Notes

## Project purpose
This project is a browser-based barcode scanner intended for mobile and desktop access. It supports camera scanning, manual entry, and exporting the scan list into a spreadsheet.

## Current architecture
- Backend: Flask web app in app.py
- Frontend: HTML in templates/index.html and static assets under static/
- Shared data: SQLite database stored as barcode_scans.db
- Deployment target: Render (public web app)
- Duplicate root-level frontend files were removed to keep the project maintainable and avoid confusion

## Key files
- app.py: Flask server and SQLite API
- templates/index.html: browser UI
- static/script.js: frontend logic, camera control, and barcode handling
- static/styles.css: frontend styling
- requirements.txt: Python dependencies
- render.yaml: Render deployment config
- wsgi.py: WSGI entry point for deployment
- README.md: user-facing setup instructions

## Important commands
- Local run:
  python app.py
- Install dependencies:
  python -m pip install -r requirements.txt
- Check app routes:
  python -c "from app import app; print(sorted(str(rule) for rule in app.url_map.iter_rules()))"
- Git status:
  git status
- Commit and push:
  git add .
  git commit -m "<message>"
  git push origin main

## Camera workflow
- Start Camera button opens the camera only.
- Scan Barcode button performs the actual read.
- This avoids false camera errors when the user has not yet aligned a barcode in the frame.

## Known issues and fixes
- iPhone camera compatibility: avoid exact device IDs; use default camera via getUserMedia + decodeOnceFromVideoElement.
- Duplicate scan blocking: add a scanLock guard to prevent repeated decode events from creating duplicate reads.

## Deployment notes
- Render should be connected to GitHub and deployed from the main branch.
- Use Gunicorn with wsgi:app as the start command.
- The app is live on the current Render URL and is meant for public access.
