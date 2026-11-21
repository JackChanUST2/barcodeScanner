# Barcode Scanner Project Notes

## Overview
A Flask barcode scanner that supports two temporary stock operations:
- Check remaining stock for the latest barcode.
- Add 1 to 9999 units for the latest barcode.

New barcodes prompt for a product name and create a stock record.

## Storage
The backend uses an in-memory SQLite database:
- Database: `sqlite3.connect(':memory:')`
- Table: `stock(barcode, name, quantity)`
- Stock data lasts only until the Python process restarts.
- Host restarts, redeployments, worker restarts, and process termination clear all stock data.

No host persistent storage is used. Do not rely on this implementation for durable inventory records.

## Backend
`app.py` provides:
- `GET /` — renders the stock page.
- `POST /api/stock/check` — returns an existing product or 404 for an unknown barcode.
- `POST /api/stock/add` — creates or increases a stock record.
- `GET /health` — reports the service and storage mode.

Stock quantities must be whole numbers from 1 to 9999 per add operation. Product names are trimmed and limited to 200 characters.

## Frontend
`static/script.js` handles:
- ZXing camera decoding.
- Continuous updating of the status with `Latest detection` while the lower `Scanned Code` field remains unchanged.
- Manual barcode entry.
- Positive quantity prompts.
- New-product name prompts.
- Check-stock and add-stock API calls.

The shared scan history, CSV export, and XLSX export were removed.

## Local Development
```powers
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

## Deployment Note
A single app process is assumed for the in-memory database. In-memory data is not shared across multiple Gunicorn workers or application replicas. For durable shared inventory, persistent SQLite disk or PostgreSQL is required.
