"""
=============================================
  MATAKU – app.py
  Backend: Flask + YOLOv8 (best.pt)
  Endpoint: POST /detect
=============================================
"""

import base64
import os
import traceback
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

# ── Inisialisasi Flask ──────────────────────────
# Gunakan static_folder='.' agar Flask bisa melayani index.html, script.js, style.css secara langsung
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)  # Izinkan request dari frontend (HTML yang dibuka via browser)


@app.route("/")
def index():
    return app.send_static_file("index.html")


# ── Load Model YOLOv8 ──────────────────────────
MODEL_PATH = (
    Path(__file__).parent / "best.pt"
) 

try:
    model = YOLO(str(MODEL_PATH))
    print(f"✅ Model berhasil dimuat dari: {MODEL_PATH}")
except Exception as e:
    print(f"❌ Gagal load model: {e}")
    model = None

# ── Label kelas bentuk wajah ───────────────────
# Sesuai data.yaml hasil training (names: heart, oblong, oval, round, square)
CLASS_NAMES = {
    0: "heart",
    1: "oblong",
    2: "oval",
    3: "round",
    4: "square",
}

# ── Warna bounding box per kelas (BGR untuk OpenCV) ──
CLASS_COLORS = {
    "oval": (199, 66, 192),  # ungu-pink
    "round": (120, 100, 230),  # ungu
    "square": (60, 130, 245),  # biru
    "heart": (60, 180, 255),  # kuning-oranye
    "oblong": (80, 200, 180),  # hijau-tosca
}
DEFAULT_COLOR = (192, 66, 192)  # pink default

# ── Rule-Based Recommendation ──────────────────
# Sesuai Tabel 3.6 "Rule Mapping Sistem" pada dokumen Metode Penelitian (Bab 3).
# Setiap bentuk wajah dipetakan ke satu atau lebih rekomendasi bingkai kacamata
# berdasarkan prinsip visual balance & contrasting shapes (Brooks & Borish, Bobbi Brown).
FRAME_RULES = {
    "heart": {
        "recommendations": ["Oval", "Aviator", "Cat-Eye"],
        "reason": "Membantu menyeimbangkan bagian dagu yang lebih sempit",
    },
    "oblong": {
        "recommendations": ["Square", "Rectangle", "Aviator"],
        "reason": "Mengurangi kesan wajah yang terlalu panjang",
    },
    "oval": {
        "recommendations": ["Round", "Oval", "Rectangle", "Square", "Cat-Eye", "Aviator"],
        "reason": "Proporsi wajah seimbang sehingga cocok dengan berbagai bentuk bingkai",
    },
    "round": {
        "recommendations": ["Rectangle", "Square", "Cat-Eye"],
        "reason": "Memberikan kontras terhadap garis wajah yang membulat",
    },
    "square": {
        "recommendations": ["Round", "Oval", "Aviator"],
        "reason": "Membantu melembutkan garis rahang yang tegas",
    },
}


def get_frame_recommendation(face_shape: str) -> dict:
    """
    Mengembalikan rekomendasi bingkai kacamata berdasarkan bentuk wajah,
    mengikuti Tabel 3.6 Rule Mapping Sistem (rule-based recommendation).
    Jika bentuk wajah tidak dikenali, kembalikan list kosong dan reason default.
    """
    rule = FRAME_RULES.get(face_shape.lower())
    if rule is None:
        return {"recommendations": [], "reason": "Bentuk wajah tidak dikenali."}
    return rule


# ── Helper: numpy image → base64 JPEG ─────────
def img_to_base64(img_bgr: np.ndarray) -> str:
    """Konversi gambar OpenCV (BGR) ke string base64 data-URL JPEG."""
    success, buffer = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise ValueError("Gagal encode gambar ke JPEG")
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


# ── Endpoint: POST /detect ─────────────────────
@app.route("/detect", methods=["POST"])
def detect():
    """
    Menerima gambar wajah via multipart/form-data (field: 'image'),
    menjalankan inferensi YOLOv8, dan mengembalikan:
    {
        "result_image": "data:image/jpeg;base64,...",
        "face_shape":   "oval",
        "confidence":   0.94,
        "bbox":         [x1, y1, x2, y2]
    }
    """
    # 1. Validasi input
    if "image" not in request.files:
        return jsonify({"error": "Field 'image' tidak ditemukan di request."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Tidak ada file yang dikirim."}), 400

    # 2. Baca gambar
    try:
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img_bgr is None:
            return (
                jsonify(
                    {
                        "error": "Gagal membaca gambar. Pastikan format didukung (JPG/PNG/WEBP)."
                    }
                ),
                400,
            )
    except Exception as e:
        return jsonify({"error": f"Error membaca file: {str(e)}"}), 400

    # 3. Cek model
    if model is None:
        return (
            jsonify(
                {
                    "error": "Model YOLOv8 belum tersedia. Pastikan best.pt ada di folder yang benar."
                }
            ),
            500,
        )

    # 4. Inferensi YOLOv8
    try:
        results = model.predict(
            source=img_bgr,
            conf=0.25,  # confidence threshold – bisa kamu sesuaikan
            imgsz=640,
            verbose=False,
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Error inferensi model: {str(e)}"}), 500

    # 5. Gambar salinan untuk anotasi
    annotated = img_bgr.copy()

    # Nilai default jika tidak ada deteksi
    best_face_shape = "unknown"
    best_confidence = 0.0
    best_bbox = None

    # 6. Kumpulkan semua deteksi, sort by confidence — SINKRONKAN gambar & badge
    #    Bug sebelumnya: gambar box semua label tapi badge ambil yg confidence tertinggi
    #    → bisa tidak sinkron. Fix: cari best dulu, baru gambar.
    all_boxes = []
    for result in results:
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            continue
        for box in boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            label = CLASS_NAMES.get(cls_id, f"class_{cls_id}")
            all_boxes.append({"conf": conf, "label": label, "bbox": [x1, y1, x2, y2]})

    # Urutkan: confidence tertinggi di index 0
    all_boxes.sort(key=lambda b: b["conf"], reverse=True)

    if all_boxes:
        best = all_boxes[0]
        best_face_shape = best["label"]
        best_confidence = best["conf"]
        best_bbox = best["bbox"]

        # HANYA gambar deteksi dengan confidence tertinggi agar sinkron dengan badge
        x1, y1, x2, y2 = best["bbox"]
        label = best["label"]
        conf = best["conf"]
        color = CLASS_COLORS.get(label, DEFAULT_COLOR)

        thickness = 3
        font_scale = 0.6
        font_thick = 2
        label_text = f"{label.upper()}  {conf*100:.1f}%"

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)

        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, font_thick)
        cv2.rectangle(annotated, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
        cv2.putText(
            annotated,
            label_text,
            (x1 + 4, y1 - 5),
            font,
            font_scale,
            (255, 255, 255),
            font_thick,
            cv2.LINE_AA,
        )

    # 7. Encode hasil ke base64
    try:
        result_b64 = img_to_base64(annotated)
    except Exception as e:
        return jsonify({"error": f"Gagal encode hasil gambar: {str(e)}"}), 500

    # 8. Tentukan rekomendasi bingkai kacamata (rule-based) berdasarkan bentuk wajah
    frame_recommendation = get_frame_recommendation(best_face_shape)

    # 9. Return JSON
    response_data = {
        "result_image": result_b64,
        "face_shape": best_face_shape,
        "confidence": round(best_confidence, 4),
        "bbox": best_bbox,
        "frame_recommendations": frame_recommendation["recommendations"],
        "recommendation_reason": frame_recommendation["reason"],
    }
    return jsonify(response_data), 200


# ── Health Check ───────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": model is not None,
            "model_path": str(MODEL_PATH),
        }
    )


# ── Run ────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"🌸 Mataku Backend berjalan di http://127.0.0.1:{port}")
    print("   Endpoint: POST /detect")
    app.run(debug=False, host="0.0.0.0", port=port)
