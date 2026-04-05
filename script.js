// ⚙️ Dán URL Web App của bạn tại đây
const API_URL =
  "https://script.google.com/macros/s/AKfycbw1Qxm2KE8Mo9Kk8k-u5z6c79QOZ0S-ye5fCD0wnznm2hYVhozkUbgoxHdks0puBo79/exec";

let buffer = []; // lưu tạm các mã chưa gửi
let isSyncing = false; // trạng thái đang đồng bộ

function updateCurrentSheet() {
  fetch(`${API_URL}?action=getCurrentSheet`)
    .then((res) => res.text())
    .then(
      (name) => (document.getElementById("currentSheet").textContent = name)
    );
}

// ✅ Thêm mã vào bộ nhớ tạm
function saveMaDon() {
  const input = document.getElementById("maDon");
  const maDon = input.value.trim();
  if (!maDon) return;

  buffer.push(maDon);
  input.value = "";
  input.focus();
  document.getElementById(
    "message"
  ).textContent = `📥 Đã thêm tạm: ${maDon} (${buffer.length} mã chờ lưu)`;
}

// 🔁 Tự động gửi dữ liệu nền mỗi 2 giây
setInterval(async () => {
  if (isSyncing || buffer.length === 0) return;
  isSyncing = true;

  const batch = [...buffer];
  buffer = []; // tạm làm rỗng trước

  try {
    const res = await fetch(`${API_URL}?action=batchSave`, {
      method: "POST",
      body: JSON.stringify(batch),
    });
    const msg = await res.text();
    document.getElementById("message").textContent = `✅ ${msg}`;
  } catch (err) {
    // nếu lỗi, khôi phục buffer
    localStorage.setItem("buffer", JSON.stringify(buffer));
    buffer = [...batch, ...buffer];
    document.getElementById("message").textContent = "⚠️ Mạng chậm, thử lại...";
  } finally {
    isSyncing = false;
  }
}, 2000);

// ---- Nhấn Enter thì thêm vào buffer ----
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("maDon");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveMaDon();
    }
  });
  updateCurrentSheet();
});

// 🧾 Tạo sheet mới
function createNewSheet() {
  const name = document.getElementById("newSheetName").value.trim();
  if (!name) return alert("Nhập tên sheet cần tạo!");
  fetch(`${API_URL}?action=newSheet&name=${encodeURIComponent(name)}`)
    .then((res) => res.text())
    .then((msg) => {
      document.getElementById("message").textContent = msg;
      updateCurrentSheet();
    })
    .catch((err) => alert("❌ Lỗi: " + err));
}

// 📄 Xuất PDF (có progress bar)
function exportPDF() {
  const sheetName = document.getElementById("sheetToExport").value.trim();
  if (!sheetName) return alert("Nhập tên sheet cần xuất PDF!");

  const btn = document.getElementById("btnExportPDF");
  const wrapper = document.getElementById("progressWrapper");
  const bar = document.getElementById("progressBar");
  const text = document.getElementById("progressText");

  // Hiển thị progress bar, disable nút
  btn.disabled = true;
  btn.textContent = "⏳ Đang xuất PDF...";
  wrapper.style.display = "block";
  bar.style.width = "0%";
  text.textContent = "0%";
  document.getElementById("message").textContent = "";

  // Giả lập tiến trình tăng dần (0% → 90%)
  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 90) {
      progress += Math.random() * 8 + 2; // tăng 2-10% mỗi lần
      if (progress > 90) progress = 90;
      bar.style.width = progress + "%";
      text.textContent = Math.round(progress) + "%";
    }
  }, 500);

  fetch(
    `${API_URL}?action=exportPDF&sheetName=${encodeURIComponent(sheetName)}`
  )
    .then((res) => res.text())
    .then((url) => {
      clearInterval(interval);
      // Hoàn tất 100%
      bar.style.width = "100%";
      text.textContent = "100%";

      setTimeout(() => {
        if (url.startsWith("http")) {
          window.open(url, "_blank");
          document.getElementById("message").textContent = "✅ Xuất PDF thành công!";
        } else {
          document.getElementById("message").textContent = url;
        }
        // Ẩn progress bar sau 1.5s
        setTimeout(() => {
          wrapper.style.display = "none";
          bar.style.width = "0%";
          text.textContent = "0%";
        }, 1500);
        btn.disabled = false;
        btn.textContent = "📄 Xuất PDF";
      }, 600);
    })
    .catch((err) => {
      clearInterval(interval);
      wrapper.style.display = "none";
      btn.disabled = false;
      btn.textContent = "📄 Xuất PDF";
      alert("❌ Lỗi: " + err);
    });
}