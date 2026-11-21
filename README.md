# Barcode Scanner

A mobile-friendly barcode and stock checker built with Flask.

## Features
- Camera-based barcode scanning
- Manual barcode entry fallback
- Check remaining stock for a barcode
- Add 1 to 9999 units
- Create a new barcode and product name

## Storage
Stock is held temporarily in an in-memory SQLite database. It resets whenever the Python process or hosted service restarts.

## Run locally
1. Install dependencies:
   `python -m pip install -r requirements.txt`
2. Start the app:
   `python app.py`
3. Open `http://localhost:5000`

For a phone on the same Wi-Fi network, use `http://<your-computer-ip>:5000`.
