/* =============================================
   MATAKU — script.js
   Frontend Logic: Kamera, Upload, Deteksi, Hasil
   ============================================= */

// ── Konfigurasi ──────────────────────────────
const API_URL = "/detect";

// ── State ─────────────────────────────────────
let currentMode = "camera";
let stream = null;
let lastResultBlob = null;
let uploadedFile = null;

// ── Deskripsi Bentuk Wajah ─────────────────────
// Deskripsi umum tiap bentuk wajah (untuk konteks di UI).
// Rekomendasi bingkai TIDAK di-hardcode di sini lagi — diambil langsung
// dari backend (app.py) yang menerapkan rule-based recommendation sesuai
// Tabel 3.6 "Rule Mapping Sistem" pada dokumen Metode Penelitian, supaya
// frontend & backend selalu konsisten (single source of truth di server).
const FACE_SHAPE_DESC = {
  oval: "Bentuk wajah Anda adalah oval. Proporsi panjang dan lebar wajah terlihat seimbang dengan garis wajah yang lembut, sehingga termasuk salah satu bentuk wajah yang paling fleksibel.",
  round: "Bentuk wajah Anda adalah bulat (round). Ciri utamanya adalah pipi yang penuh dengan panjang dan lebar wajah yang hampir sama serta garis wajah yang lembut.",
  square: "Bentuk wajah Anda adalah persegi (square). Bentuk ini memiliki rahang yang tegas, dahi yang lebar, dan sudut wajah yang lebih terlihat.",
  heart: "Bentuk wajah Anda adalah hati (heart). Ciri khasnya adalah dahi yang lebih lebar, tulang pipi yang menonjol, dan dagu yang lebih sempit.",
  oblong: "Bentuk wajah Anda adalah lonjong (oblong). Wajah memiliki panjang yang lebih dominan dibanding lebarnya dengan bentuk yang cenderung memanjang.",
};

// Info tampilan (deskripsi singkat + gambar) untuk tiap JENIS bingkai
// yang muncul pada Tabel 3.6: Round, Oval, Rectangle, Square, Cat-Eye, Aviator.
const FRAME_INFO = {
  round: {
    desc: "Frame berbentuk bulat dengan garis lengkung yang memberikan tampilan lembut dan klasik.",
  },
  oval: {
    desc: "Frame oval memiliki bentuk yang seimbang dengan sudut yang halus sehingga memberikan kesan sederhana dan elegan.",
  },
  rectangle: {
    desc: "Frame persegi panjang menampilkan garis yang tegas dan desain yang modern untuk tampilan yang rapi.",
  },
  square: {
    desc: "Frame persegi memiliki sudut yang jelas dan memberikan kesan kuat, profesional, serta berkarakter.",
  },
  "cat-eye": {
    desc: "Frame cat-eye memiliki sudut atas yang terangkat sehingga memberikan tampilan yang elegan dan fashionable.",
  },
  aviator: {
    desc: "Frame aviator memiliki desain ramping dengan lensa berukuran cukup besar yang memberikan tampilan seimbang dan berkarakter.",
  },
};

// ── Utility ────────────────────────────────────
function show(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "";
    el.classList.add("fade-in");
    setTimeout(() => el.classList.remove("fade-in"), 500);
  }
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Mode Toggle ────────────────────────────────
function switchMode(mode) {
  currentMode = mode;
  resetAll();

  const btnCam = document.getElementById("btnCamera");
  const btnUp = document.getElementById("btnUpload");
  const camSec = document.getElementById("cameraSection");
  const upSec = document.getElementById("uploadSection");

  if (mode === "camera") {
    btnCam.classList.add("mode-active");
    btnUp.classList.remove("mode-active");
    camSec.style.display = "";
    upSec.style.display = "none";
  } else {
    btnUp.classList.add("mode-active");
    btnCam.classList.remove("mode-active");
    upSec.style.display = "";
    camSec.style.display = "none";
    stopCamera();
  }
}

// ── KAMERA ────────────────────────────────────
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    const video = document.getElementById("video");
    video.srcObject = stream;
    video.style.display = "block";
    document.getElementById("cameraPlaceholder").style.display = "none";
    document.getElementById("cameraCanvas").style.display = "none";
    document.getElementById("cameraOverlay").style.display = "flex";
    document.getElementById("captureBtn").disabled = false;
    document.getElementById("startCameraBtn").style.display = "none";
    document.getElementById("stopCameraBtn").style.display = "inline-flex";
  } catch (err) {
    showError("Gagal mengakses kamera: " + err.message + ". Pastikan izin kamera sudah diberikan.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  const video = document.getElementById("video");
  if (video) {
    video.srcObject = null;
    video.style.display = "none";
  }
  const placeholder = document.getElementById("cameraPlaceholder");
  if (placeholder) placeholder.style.display = "flex";
  const canvas = document.getElementById("cameraCanvas");
  if (canvas) canvas.style.display = "none";
  const overlay = document.getElementById("cameraOverlay");
  if (overlay) overlay.style.display = "none";
  const captureBtn = document.getElementById("captureBtn");
  if (captureBtn) captureBtn.disabled = true;
  const startBtn = document.getElementById("startCameraBtn");
  if (startBtn) startBtn.style.display = "inline-flex";
  const stopBtn = document.getElementById("stopCameraBtn");
  if (stopBtn) stopBtn.style.display = "none";
}

function captureFrame() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("cameraCanvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) { showError("Gagal mengambil gambar dari kamera."); return; }
    sendToAPI(blob);
  }, "image/jpeg", 0.92);
}

// ── UPLOAD ────────────────────────────────────
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Hanya file gambar (JPG, PNG, WEBP) yang didukung.");
    return;
  }
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("previewImage").src = e.target.result;
    show("previewContainer");
  };
  reader.readAsDataURL(file);
}

function detectFromUpload() {
  if (!uploadedFile) { showError("Pilih gambar terlebih dahulu."); return; }
  sendToAPI(uploadedFile);
}

function resetUpload() {
  uploadedFile = null;
  document.getElementById("fileInput").value = "";
  hide("previewContainer");
  hide("resultSection");
  hide("errorSection");
}

// ── API CALL ──────────────────────────────────
async function sendToAPI(imageBlob) {
  hide("resultSection");
  hide("errorSection");
  show("loadingSection");
  animateLoadingSteps();

  const formData = new FormData();
  formData.append("image", imageBlob, "face.jpg");

  try {
    const response = await fetch(API_URL, { method: "POST", body: formData });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    hide("loadingSection");
    renderResults(data);

  } catch (err) {
    hide("loadingSection");
    showError("Gagal menghubungi server: " + err.message +
      ". Pastikan backend Flask sudah berjalan di " + API_URL);
  }
}

// Animate loading steps
function animateLoadingSteps() {
  const steps = ["lstep1", "lstep2", "lstep3"];
  steps.forEach(id => document.getElementById(id)?.classList.remove("active"));
  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      document.getElementById(steps[i])?.classList.add("active");
      i++;
    } else {
      clearInterval(interval);
    }
  }, 600);
}

// ── RENDER HASIL ──────────────────────────────
function renderResults(data) {
  // Image
  const resultImg = document.getElementById("resultImage");
  resultImg.src = data.result_image;
  lastResultBlob = data.result_image;

  const faceShape = (data.face_shape || "unknown").toLowerCase();
  const confidence = data.confidence ? data.confidence : 0;
  const confPct = (confidence * 100).toFixed(1);
  const bboxText = data.bbox
    ? `[${data.bbox.map(v => Math.round(v)).join(", ")}]`
    : "—";

  // Headline
  document.getElementById("resultHeadline").textContent =
    "Wajah " + capitalize(faceShape) + " Terdeteksi";

  // Face shape badge
  document.getElementById("faceShapeText").textContent = capitalize(faceShape);

  // Confidence bar
  document.getElementById("confValue").textContent = confPct + "%";
  setTimeout(() => {
    document.getElementById("confBar").style.width = confPct + "%";
  }, 200);

  // Bbox
  document.getElementById("bboxValue").textContent = bboxText;

  // Description
  const shapeDesc = FACE_SHAPE_DESC[faceShape] || "";
  const reason = data.recommendation_reason || "";
  document.getElementById("faceShapeDesc").textContent =
    [shapeDesc, reason].filter(Boolean).join(" ");

  // Reco shape tag
  document.getElementById("recoShapeTag").textContent = capitalize(faceShape);

  // Glasses grid — dibangun dari rekomendasi rule-based backend (Tabel 3.6),
  // bukan data statis di frontend, supaya rekomendasi yang tampil selalu
  // sesuai dengan hasil deteksi bentuk wajah yang sebenarnya.
  const frameList = Array.isArray(data.frame_recommendations) ? data.frame_recommendations : [];

  const glassesHTML = frameList.map(frameName => {
    const key = frameName.toLowerCase();
    const info = FRAME_INFO[key] || { desc: "" };
    const slug = key.replace(/\s+/g, "-");
    return `
    <div class="glasses-item">
      <div class="glasses-item-placeholder">
        <svg width="48" height="24" viewBox="0 0 80 28" fill="none">
          <rect x="1" y="4" width="28" height="20" rx="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <rect x="51" y="4" width="28" height="20" rx="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <line x1="29" y1="14" x2="51" y2="14" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        </svg>
      </div>
      <img
        src="glasses/frames/${slug}.png"
        alt="${frameName}"
        style="width:100%;height:70px;object-fit:contain;display:none;background:var(--cream-2);border-radius:var(--radius-sm);padding:8px;"
        onload="this.previousElementSibling.style.display='none';this.style.display='block';"
        onerror="this.style.display='none';"
      />
      <div class="glasses-name">${frameName}</div>
      <div class="glasses-desc">${info.desc}</div>
    </div>
  `;
  }).join("");

  document.getElementById("glassesGrid").innerHTML = glassesHTML ||
    `<p class="detection-desc">Tidak ada rekomendasi bingkai untuk bentuk wajah ini.</p>`;

  show("resultSection");
  setTimeout(() => {
    document.getElementById("resultSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

// ── DOWNLOAD ──────────────────────────────────
function downloadResult() {
  if (!lastResultBlob) return;
  const a = document.createElement("a");
  a.href = lastResultBlob;
  a.download = "mataku-hasil-deteksi.jpg";
  a.click();
}

// ── ERROR ─────────────────────────────────────
function showError(msg) {
  document.getElementById("errorMessage").textContent = msg;
  show("errorSection");
}

// ── RESET ─────────────────────────────────────
function resetAll() {
  stopCamera();
  hide("loadingSection");
  hide("resultSection");
  hide("errorSection");
  hide("previewContainer");
  uploadedFile = null;
  lastResultBlob = null;
  const fi = document.getElementById("fileInput");
  if (fi) fi.value = "";
  // Scroll kembali ke panel analyzer agar pengguna dapat langsung mulai ulang analisis
  const analyzer = document.getElementById('analyzer');
  if (analyzer) analyzer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Drag & Drop ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const dz = document.getElementById("dropZone");
  if (!dz) return;

  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      uploadedFile = file;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById("previewImage").src = ev.target.result;
        show("previewContainer");
      };
      reader.readAsDataURL(file);
    }
  });
});
