# 🌸 Mataku – Mana Kacamataku?

Website deteksi bentuk wajah & rekomendasi kacamata berbasis YOLOv8.

## 📁 Struktur File

```
mataku/
├── index.html        ← Halaman utama
├── style.css         ← Styling (pink & white theme)
├── script.js         ← Frontend logic (kamera, upload, fetch API)
├── app.py            ← Backend Flask + YOLOv8
├── requirements.txt  ← Dependency Python
├── best.pt           ← ⬅️ Letakkan model YOLOv8 kamu di sini!
└── README.md
```

## 🚀 Cara Menjalankan

### 1. Install dependency Python
```bash
pip install -r requirements.txt
```

### 2. Letakkan model
Salin file `best.pt` (hasil training YOLOv8) ke folder ini.

### 3. Jalankan backend Flask
```bash
python app.py
```
Backend akan berjalan di: `http://127.0.0.1:5000`

### 4. Buka frontend
Buka `index.html` di browser.  
> ⚠️ **Catatan CORS**: Supaya fetch ke Flask bisa bekerja, buka dengan browser langsung (double-click) ATAU gunakan Live Server di VS Code.

---

## 🔧 Konfigurasi

### URL API
Di `script.js` baris 7, ubah `API_URL` jika deploy ke server lain:
```js
const API_URL = "http://127.0.0.1:5000/detect";
// Contoh production: const API_URL = "https://mataku-api.example.com/detect";
```

### Label Kelas YOLOv8
Di `app.py` baris ~38, sesuaikan `CLASS_NAMES` dengan urutan kelas di model kamu:
```python
CLASS_NAMES = {
    0: "oval",
    1: "round",
    2: "square",
    3: "heart",
    4: "oblong",
}
```

---

## 🌐 Deploy (Hosting)

### Frontend
- Upload `index.html`, `style.css`, `script.js` ke **Netlify / Vercel / GitHub Pages**
- Update `API_URL` di `script.js` sesuai URL backend

### Backend Flask
- Deploy ke **Railway / Render / Heroku**
- Tambahkan `Procfile`:  
  ```
  web: gunicorn app:app
  ```
- Install tambahan: `pip install gunicorn`
- Pastikan `best.pt` ikut ter-upload ke server

---

## 📊 Format Response API

```json
{
  "result_image": "data:image/jpeg;base64,...",
  "face_shape":   "oval",
  "confidence":   0.94,
  "bbox":         [120, 50, 380, 320]
}
```

---

*Dibuat untuk keperluan Tugas Akhir / Skripsi* 🌸
