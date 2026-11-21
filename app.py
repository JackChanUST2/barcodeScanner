from __future__ import annotations

import sqlite3
import threading

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# No persistent storage is available, so use one in-memory SQLite database.
# Data exists only while this Python process is running.
db_lock = threading.Lock()
db_connection = sqlite3.connect(":memory:", check_same_thread=False)
db_connection.row_factory = sqlite3.Row


def init_db():
    with db_lock:
        db_connection.execute(
            """
            CREATE TABLE IF NOT EXISTS stock (
                barcode TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0
            )
            """
        )


def normalize_barcode(value):
    return (value or "").strip()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stock/check", methods=["POST"])
def check_stock():
    payload = request.get_json(silent=True) or {}
    barcode = normalize_barcode(payload.get("barcode"))

    if not barcode:
        return jsonify({"error": "Barcode is required."}), 400

    with db_lock:
        row = db_connection.execute(
            "SELECT barcode, name, quantity FROM stock WHERE barcode = ?",
            (barcode,),
        ).fetchone()

    if not row:
        return jsonify({"found": False, "barcode": barcode}), 404

    return jsonify({
        "found": True,
        "barcode": row["barcode"],
        "name": row["name"],
        "quantity": row["quantity"],
    })


@app.route("/api/stock/add", methods=["POST"])
def add_stock():
    payload = request.get_json(silent=True) or {}
    barcode = normalize_barcode(payload.get("barcode"))

    try:
        quantity = int(payload.get("quantity"))
    except (TypeError, ValueError):
        return jsonify({"error": "Quantity must be a whole number from 1 to 9999."}), 400

    if not barcode:
        return jsonify({"error": "Barcode is required."}), 400
    if quantity < 1 or quantity > 9999:
        return jsonify({"error": "Quantity must be between 1 and 9999."}), 400

    name = normalize_barcode(payload.get("name"))

    with db_lock:
        row = db_connection.execute(
            "SELECT barcode, name, quantity FROM stock WHERE barcode = ?",
            (barcode,),
        ).fetchone()

        if row:
            new_quantity = row["quantity"] + quantity
            db_connection.execute(
                "UPDATE stock SET quantity = ? WHERE barcode = ?",
                (new_quantity, barcode),
            )
            db_connection.commit()
            product_name = row["name"]
        else:
            if not name:
                return jsonify({"error": "A product name is required for a new barcode.", "new_product": True}), 400

            db_connection.execute(
                "INSERT INTO stock (barcode, name, quantity) VALUES (?, ?, ?)",
                (barcode, name[:200], quantity),
            )
            db_connection.commit()
            product_name = name[:200]
            new_quantity = quantity

    return jsonify({
        "barcode": barcode,
        "name": product_name,
        "quantity": new_quantity,
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok", "storage": "memory"})


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
