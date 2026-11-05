from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "barcode_scans.db"

app = Flask(__name__)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/scans", methods=["GET"])
def get_scans():
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, barcode, created_at FROM scans ORDER BY id DESC"
    ).fetchall()
    scans = [
        {
            "id": row["id"],
            "barcode": row["barcode"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    conn.close()
    return jsonify(scans)


@app.route("/api/scans", methods=["POST"])
def create_scan():
    payload = request.get_json(silent=True) or {}
    barcode = (payload.get("barcode") or "").strip()

    if not barcode:
        return jsonify({"error": "Barcode is required."}), 400

    created_at = datetime.utcnow().strftime("%d/%m/%Y %H:%M:%S")

    conn = get_db_connection()
    cursor = conn.execute(
        "INSERT INTO scans (barcode, created_at) VALUES (?, ?)",
        (barcode, created_at),
    )
    conn.commit()
    scan_id = cursor.lastrowid
    conn.close()

    return jsonify({"id": scan_id, "barcode": barcode, "created_at": created_at}), 201


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
