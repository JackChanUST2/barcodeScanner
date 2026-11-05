# Barcode Scanner

A mobile-friendly barcode scanner for phones and desktop browsers, built as a multi-user web app. The app stores scan data in a shared SQLite database so more than one device can read from the same list.

## Features
- Camera-based barcode scanning from the browser
- Works on mobile devices and desktop browsers
- Shared scan history across users
- Manual barcode entry fallback
- Export scan history to CSV or XLSX

## Run locally
1. Open a terminal in this folder.
2. Install dependencies:
   python -m pip install -r requirements.txt
3. Start the app:
   python app.py
4. Open this in a browser:
   http://localhost:5000

For a phone on the same Wi-Fi network, use:
http://<your-computer-ip>:5000

## Notes
- Allow camera permissions when the page asks for them.
- Data is stored in a shared SQLite database at barcode_scans.db.
- The app is ready for a simple shared local-network or hosted deployment.
