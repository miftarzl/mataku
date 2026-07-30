# 🤓 Panduan Gambar Kacamata Mataku

## 📁 Struktur Folder

Semua gambar frame disimpan di **satu folder saja** (bukan per bentuk wajah), karena satu tipe frame bisa direkomendasikan untuk beberapa bentuk wajah sekaligus:

```
mataku/
└── glasses/
    └── frames/
        ├── round.png
        ├── oval.png
        ├── rectangle.png
        ├── square.png
        ├── cat-eye.png
        └── aviator.png
```

Nama file **harus persis** seperti di atas (lowercase, pakai tanda strip untuk `cat-eye`) karena diambil otomatis dari nama rekomendasi backend.

---

## 📋 Rule Mapping (sesuai Tabel 3.6 di `app.py`)

| Bentuk Wajah | Rekomendasi Frame | Alasan |
|---|---|---|
| **Heart** | Oval, Aviator, Cat-Eye | Menyeimbangkan bagian dagu yang lebih sempit |
| **Oblong** | Square, Rectangle, Aviator | Mengurangi kesan wajah yang terlalu panjang |
| **Oval** | Round, Oval, Rectangle, Square, Cat-Eye, Aviator | Proporsi wajah seimbang, cocok dengan semua frame |
| **Round** | Rectangle, Square, Cat-Eye | Memberi kontras terhadap garis wajah yang membulat |
| **Square** | Round, Oval, Aviator | Melembutkan garis rahang yang tegas |

Jadi total hanya **6 gambar frame** yang perlu disiapkan (Round, Oval, Rectangle, Square, Cat-Eye, Aviator) — bukan per bentuk wajah. Frontend (`script.js`) otomatis menampilkan kombinasi yang sesuai berdasarkan `frame_recommendations` yang dikirim `app.py`.

---

## 📸 Spesifikasi Gambar

- **Format**: PNG
- **Ukuran**: 160 x 80 px (optimal untuk display card), boleh mendekati asalkan rasio serupa
- **Background**: Transparan atau solid color senada tema pink/cream
- **Isi gambar**: Kacamata tampak depan, jelas & terlihat penuh

---

## ✅ Checklist Sebelum Testing

- [ ] Folder `glasses/frames/` sudah ada
- [ ] Berisi 6 file: `round.png`, `oval.png`, `rectangle.png`, `square.png`, `cat-eye.png`, `aviator.png`
- [ ] Semua nama file lowercase & sesuai persis (termasuk strip di `cat-eye`)
- [ ] Folder lama `glasses/oval/`, `glasses/round/`, `glasses/square/`, `glasses/heart/`, `glasses/oblong/` sudah dihapus (tidak dipakai lagi)

---

## 🔧 Menambah/Mengubah Gambar

1. **Tambah/ganti gambar**: cukup timpa file di `glasses/frames/` dengan nama yang sesuai
2. **Nama frame baru** (di luar 6 tipe di atas): tambahkan dulu key barunya di `FRAME_INFO` (`script.js`) dan/atau `FRAME_RULES` (`app.py`), baru siapkan file gambarnya

---

## 📝 Contoh Path yang Dipakai di Code

Di `script.js`, path gambar dibentuk otomatis dari nama rekomendasi:

```javascript
src="glasses/frames/${slug}.png"
```

Contoh: rekomendasi `"Cat-Eye"` → slug `"cat-eye"` → otomatis load `glasses/frames/cat-eye.png`.

---

**Status**: ✅ Siap diisi 6 gambar frame di `glasses/frames/`
