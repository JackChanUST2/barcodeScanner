# Barcode Scanner

A mobile-friendly barcode and stock checker built with Flask. It is currently designed for temporary in-memory stock data because the host has no persistent storage.

## Features
- Camera-based barcode scanning from the browser
- Manual barcode entry fallback
- Check the remaining quantity for a barcode
- Add 1 to 9999 units for an existing barcode
- Create a new barcode and product name when it is first added

## Important storage note
Stock records are held in an in-memory SQLite database. They remain available only until the Python process restarts or the host restarts. Redeploying or restarting the service clears all stock data. This is intentional until persistent storage is available.

## Run locally
1. Open a terminal in this folder.
2. Install dependencies:
   `python -m pip install -r requirements.txt`
3. Start the app:
   `python app.py`
4. Open:
   `http://localhost:5000`

For a phone on the same Wi-Fi network, use:
`http://<your-computer-ip>:5000`

Allow camera permissions when the page asks for them.
