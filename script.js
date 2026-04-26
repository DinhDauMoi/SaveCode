// ⚙️ Dán URL Web App của bạn tại đây
const API_URL =
  "https://script.google.com/macros/s/AKfycbyb9rBPg6N1AiXY0-5UCxHOZuWv8NUIKgmZoIXU8Or2Opann5416_L62eQQGL-dvngE/exec";

let buffer = []; // lưu tạm các mã chưa gửi
let isSyncing = false; // trạng thái đang đồng bộ
let scannedCodes = new Set(); // lưu trữ mã đã quét trong phiên để kiểm tra trùng lặp

// Khôi phục mã đã quét từ localStorage để chống trùng ngay cả khi tải lại trang
try {
  const saved = JSON.parse(localStorage.getItem("scannedCodes"));
  if (Array.isArray(saved)) {
    scannedCodes = new Set(saved);
  }
} catch (e) {}

// Cập nhật giao diện: hiển thị các mã lạ
function updateUnusualCodesDisplay(code) {
  const area = document.getElementById("unusualCodes");
  if (!area) return;
  const upper = code.toUpperCase();
  if (!upper.startsWith("FRK") && !upper.startsWith("TR80001")) {
    area.value = area.value ? area.value + "\n" + code : code;
    area.scrollTop = area.scrollHeight;
  }
}

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

  // Lọc trùng: Kiểm tra xem mã đã được quét chưa (trong phiên hoặc trong buffer chờ gửi)
  if (scannedCodes.has(maDon) || buffer.includes(maDon)) {
    document.getElementById("message").textContent = `❌ Trùng lặp: Mã "${maDon}" đã được quét! Không lưu.`;
    input.value = "";
    input.focus();
    return;
  }

  // ==== Tìm kiếm / Tra cứu mã ====
  const targetArea = document.getElementById("targetsInput");
  let isTargetFound = false;
  if (targetArea && targetArea.value.trim() !== "") {
    let lines = targetArea.value.split('\n');
    let matched = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === maDon) {
        lines[i] = lines[i] + " ✅";
        matched = true;
        isTargetFound = true;
      }
    }
    if (matched) {
      targetArea.value = lines.join('\n');
      targetArea.dispatchEvent(new Event('input')); // Update display count
    }
  }

  // Thêm vào danh sách đã quét và lưu cục bộ
  scannedCodes.add(maDon);
  localStorage.setItem("scannedCodes", JSON.stringify([...scannedCodes]));

  // Cảnh báo nếu mã định dạng lạ
  updateUnusualCodesDisplay(maDon);

  buffer.push(maDon);
  input.value = "";
  input.focus();
  
  if (isTargetFound) {
    document.getElementById("message").textContent = `🎯 TÌM THẤY MÃ TRA CỨU: ${maDon}`;
  } else {
    document.getElementById("message").textContent = `📥 Đã thêm tạm: ${maDon} (${buffer.length} mã chờ lưu)`;
  }
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
  
  // Khôi phục danh sách mã lạ khi F5
  scannedCodes.forEach(c => updateUnusualCodesDisplay(c));
});

// 🧾 Tạo sheet mới
function createNewSheet() {
  const name = document.getElementById("newSheetName").value.trim();
  if (!name) return alert("Nhập tên sheet cần tạo!");
  fetch(`${API_URL}?action=newSheet&name=${encodeURIComponent(name)}`)
    .then((res) => res.text())
    .then((msg) => {
      document.getElementById("message").textContent = msg;
      
      // Xoá dữ liệu mã quét tạm khi tạo trang mới để bắt đầu phiên mới
      scannedCodes.clear();
      localStorage.removeItem("scannedCodes");
      
      const area = document.getElementById("unusualCodes");
      if (area) area.value = "";
      
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