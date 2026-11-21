# Barcode Scanner Project Notes

## Overview
A Flask barcode scanner with stock check and stock add operations using temporary in-memory SQLite storage.

## Storage
- Database: SQLite `:memory:` connection
- Table: `stock(barcode, name, quantity)`
- Stock resets when the Python process restarts or the Render service redeploys/restarts.
- Data is shared only within one process and is not durable.

## Backend
- `GET /` renders the stock page.
- `POST /api/stock/check` checks a barcode.
- `POST /api/stock/add` creates or increases a stock record.
- `GET /health` reports service status and memory storage.

## Validation
- Quantities must be integers from 1 to 9999.
- New barcodes require a product name.
- Existing barcode names are retained.

## Frontend
- Continuous ZXing detection updates status through `Latest detection`.
- The lower `Scanned Code` field updates only after pressing `Scan Barcode` or `Use Barcode`.
- Check Stock and Add Stock operate on the confirmed scanned code.

## Run locally
```powershell
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.
