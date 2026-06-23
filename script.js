// ⚙️ Dán URL Web App của bạn tại đây
const API_URL =
  "https://script.google.com/macros/s/AKfycbz60nwi9g2ncQq885JP_R9pDAQjuYjl6Qyvfh7LQ4rvAmJNal5BChDMv4uq92ljHJfh/exec";

// ⚙️ URL RIÊNG cho phần so sánh dữ liệu sheet
const COMPARE_API_URL = "https://script.google.com/macros/s/AKfycbw5JJypEVYD_XD6-293-dTkk8R-31ZIMCSKOqE8jPNPqgeP1gsiVq4pu8YxcD_01dQX/exec";

let buffer = []; // lưu tạm các mã chưa gửi
let isSyncing = false; // trạng thái đang đồng bộ
let scannedCodes = new Set(); // lưu trữ mã đã quét trong phiên để kiểm tra trùng lặp

// ====== Sheet Comparison State ======
let sheetComparisonData = []; // danh sách mã từ sheet đã chọn
let matchedCodes = new Set(); // mã đã khớp (đã nhận)
let allReceivedCodes = new Set(); // tất cả các mã đã nhận từ sheet làm việc + đã quét

// Khôi phục mã đã quét từ localStorage để chống trùng ngay cả khi tải lại trang
try {
  const saved = JSON.parse(localStorage.getItem("scannedCodes"));
  if (Array.isArray(saved)) {
    scannedCodes = new Set(saved);
  }
} catch (e) {}

// Khôi phục dữ liệu so sánh sheet
try {
  const savedComparison = JSON.parse(localStorage.getItem("comparisonData"));
  const savedMatched = JSON.parse(localStorage.getItem("matchedCodes"));
  const savedReceived = JSON.parse(localStorage.getItem("allReceivedCodes"));
  if (Array.isArray(savedComparison) && savedComparison.length > 0) {
    sheetComparisonData = savedComparison;
    matchedCodes = new Set(Array.isArray(savedMatched) ? savedMatched : []);
    allReceivedCodes = new Set(Array.isArray(savedReceived) ? savedReceived : []);
    // Sẽ render lại sau khi DOM sẵn sàng
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

  // Lọc trùng: Chỉ kiểm tra trong buffer chờ gửi (server sẽ kiểm tra trùng trên sheet)
  if (buffer.includes(maDon)) {
    document.getElementById("message").textContent = `❌ Trùng lặp: Mã "${maDon}" đang trong hàng chờ gửi!`;
    input.value = "";
    // Chỉ focus input khi KHÔNG đang quét bằng camera
    if (!scannerIsRunning) input.focus();
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

  // So sánh với dữ liệu sheet (nếu đã tải)
  compareWithSheet(maDon);

  buffer.push(maDon);
  input.value = "";
  // Chỉ focus input khi KHÔNG đang quét bằng camera (tránh bàn phím nhảy lên trên mobile)
  if (!scannerIsRunning) input.focus();
  
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

  // Khôi phục bảng so sánh nếu có
  if (sheetComparisonData.length > 0) {
    renderComparisonTable();
    // Tự động đồng bộ trạng thái đã nhận từ sheet đang làm việc
    syncMatchedCodesWithWorkingSheet();
  }

  // Tải danh sách sheet cho comparison
  loadSheetList();
});

// 🔄 Đồng bộ các mã đã quét từ sheet đang làm việc về giao diện so sánh
function syncMatchedCodesWithWorkingSheet() {
  fetch(`${API_URL}?action=getData`)
    .then(r => r.json())
    .then(workingData => {
      if (Array.isArray(workingData)) {
        const existingCodes = new Set();
        workingData.forEach(row => {
          const code = String(row.code || row).trim();
          if (code) existingCodes.add(code);
        });

        // Cập nhật allReceivedCodes
        allReceivedCodes = new Set([...existingCodes, ...scannedCodes]);
        localStorage.setItem("allReceivedCodes", JSON.stringify([...allReceivedCodes]));

        // Cập nhật matchedCodes
        sheetComparisonData.forEach(code => {
          if (existingCodes.has(code) || scannedCodes.has(code)) {
            matchedCodes.add(code);
          }
        });
        localStorage.setItem("matchedCodes", JSON.stringify([...matchedCodes]));
        renderComparisonTable();
      }
    })
    .catch(err => console.warn("Không thể tự động đồng bộ dữ liệu sheet:", err));
}

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
      allReceivedCodes.clear();
      localStorage.removeItem("allReceivedCodes");
      matchedCodes.clear();
      localStorage.removeItem("matchedCodes");
      renderComparisonTable();
      
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


// ╔══════════════════════════════════════════════╗
// ║     📷 BARCODE / QR SCANNER MODULE          ║
// ╚══════════════════════════════════════════════╝

let html5QrCode = null;
let scannerIsRunning = false;
let scannerPaused = false;

// 🔊 Phát tiếng bíp bằng Web Audio API
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    
    // Fade out để không bị pop
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.warn('Không thể phát beep:', e);
  }
}

// 📷 Mở scanner modal
function openScanner() {
  const modal = document.getElementById('scannerModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const statusText = document.getElementById('scannerStatusText');
  const statusEl = document.getElementById('scannerStatus');
  statusText.textContent = 'Đang khởi động camera...';
  statusEl.className = 'scanner-status scanner-status-loading';

  // Hide last scanned area
  document.getElementById('lastScannedArea').style.display = 'none';

  // Khởi tạo scanner
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("scannerPreview");
  }

  // Tính kích thước qrbox dựa trên màn hình, to hơn để dễ quét
  const screenW = window.innerWidth;
  const qrboxW = Math.min(Math.floor(screenW * 0.75), 450);
  const qrboxH = Math.min(Math.floor(qrboxW * 0.6), 300);

  const config = {
    fps: 15,
    qrbox: { width: qrboxW, height: qrboxH },
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
    ]
  };

  html5QrCode.start(
    { facingMode: "environment" }, // Camera sau
    config,
    onScanSuccess,
    onScanFailure
  ).then(() => {
    scannerIsRunning = true;
    scannerPaused = false;
    statusText.textContent = 'Đang chờ quét... Đưa mã vào khung hình';
    statusEl.className = 'scanner-status scanner-status-ready';
  }).catch((err) => {
    console.error("Lỗi mở camera:", err);
    statusText.textContent = 'Lỗi: Không thể mở camera. Kiểm tra quyền truy cập.';
    statusEl.className = 'scanner-status scanner-status-error';
  });
}

// ✅ Callback khi quét thành công
function onScanSuccess(decodedText, decodedResult) {
  if (scannerPaused) return; // Đang trong thời gian delay, bỏ qua

  scannerPaused = true;

  // Phát tiếng bíp
  playBeep();

  // Cập nhật trạng thái UI
  const statusText = document.getElementById('scannerStatusText');
  const statusEl = document.getElementById('scannerStatus');
  statusText.textContent = `✅ Đã quét: ${decodedText}`;
  statusEl.className = 'scanner-status scanner-status-success';

  // Hiển thị mã vừa quét
  const lastArea = document.getElementById('lastScannedArea');
  const lastCode = document.getElementById('lastScannedCode');
  lastArea.style.display = 'flex';
  lastCode.textContent = decodedText;

  // Đưa mã vào input và tự động lưu
  const input = document.getElementById('maDon');
  input.value = decodedText;
  saveMaDon();

  // Auto resume sau 1 giây
  setTimeout(() => {
    if (scannerIsRunning && html5QrCode) {
      scannerPaused = false;
      statusText.textContent = 'Đang chờ quét... Đưa mã vào khung hình';
      statusEl.className = 'scanner-status scanner-status-ready';
    }
  }, 1000);
}

// Callback khi quét không thành công (liên tục, ignore)
function onScanFailure(error) {
  // Bỏ qua - không cần xử lý
}

// ❌ Đóng scanner modal
function closeScanner() {
  const modal = document.getElementById('scannerModal');
  
  if (html5QrCode && scannerIsRunning) {
    html5QrCode.stop().then(() => {
      scannerIsRunning = false;
      scannerPaused = false;
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }).catch((err) => {
      console.warn("Lỗi khi dừng camera:", err);
      scannerIsRunning = false;
      scannerPaused = false;
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });
  } else {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}


// ╔══════════════════════════════════════════════╗
// ║  📊 SHEET COMPARISON MODULE                 ║
// ╚══════════════════════════════════════════════╝

// 📋 Tải danh sách sheet từ Apps Script
function loadSheetList() {
  const select = document.getElementById('sheetSelect');
  
  // Giữ lại option đầu tiên
  select.innerHTML = '<option value="">-- Đang tải... --</option>';

  fetch(`${COMPARE_API_URL}?action=getSheetNames`)
    .then(res => res.json())
    .then(data => {
      select.innerHTML = '<option value="">-- Chọn sheet --</option>';
      if (Array.isArray(data)) {
        data.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          select.appendChild(opt);
        });
      }
    })
    .catch(err => {
      console.warn("Không thể tải danh sách sheet:", err);
      select.innerHTML = '<option value="">-- Lỗi tải danh sách --</option>';
    });
}

// 📥 Tải dữ liệu mã từ sheet đã chọn + đọc dữ liệu sheet đang làm việc để so khớp
function loadSheetData() {
  const select = document.getElementById('sheetSelect');
  const sheetName = select.value;
  
  if (!sheetName) {
    alert('Vui lòng chọn sheet trước!');
    return;
  }

  const btn = document.getElementById('btnLoadData');
  const loading = document.getElementById('comparisonLoading');
  
  // Show loading
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Đang tải...';
  loading.style.display = 'flex';

  // Fetch song song: dữ liệu sheet so sánh + dữ liệu sheet đang làm việc
  Promise.all([
    fetch(`${COMPARE_API_URL}?action=getSheetData&sheetName=${encodeURIComponent(sheetName)}`).then(r => r.json()),
    fetch(`${API_URL}?action=getData`).then(r => r.json()).catch(() => [])
  ])
    .then(([compareData, workingData]) => {
      if (Array.isArray(compareData)) {
        sheetComparisonData = compareData.map(item => String(item).trim()).filter(item => item !== '');
        matchedCodes = new Set();

        // Lấy danh sách mã đã có trong sheet đang làm việc (API_URL)
        const existingCodes = new Set();
        if (Array.isArray(workingData)) {
          workingData.forEach(row => {
            const code = String(row.code || row).trim();
            if (code) existingCodes.add(code);
          });
        }

        // So khớp: mã nào trong sheet so sánh mà đã có trong sheet đang làm → đánh dấu đã nhận
        sheetComparisonData.forEach(code => {
          if (existingCodes.has(code) || scannedCodes.has(code)) {
            matchedCodes.add(code);
          }
        });

        // Cập nhật và lưu allReceivedCodes
        allReceivedCodes = new Set([...existingCodes, ...scannedCodes]);
        localStorage.setItem("allReceivedCodes", JSON.stringify([...allReceivedCodes]));

        // Lưu vào localStorage
        localStorage.setItem("comparisonData", JSON.stringify(sheetComparisonData));
        localStorage.setItem("matchedCodes", JSON.stringify([...matchedCodes]));

        renderComparisonTable();
        document.getElementById("message").textContent = `✅ Đã tải ${sheetComparisonData.length} mã từ sheet "${sheetName}" (${matchedCodes.size} đã nhận)`;
      } else {
        document.getElementById("message").textContent = `❌ Dữ liệu sheet không hợp lệ`;
      }
    })
    .catch(err => {
      console.error("Lỗi tải dữ liệu sheet:", err);
      document.getElementById("message").textContent = `❌ Lỗi tải dữ liệu: ${err.message}`;
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Tải Dữ Liệu`;
      loading.style.display = 'none';
    });
}

// 🔍 So sánh mã mới nhập với sheet data
function compareWithSheet(code) {
  allReceivedCodes.add(code);
  localStorage.setItem("allReceivedCodes", JSON.stringify([...allReceivedCodes]));

  if (sheetComparisonData.length === 0) return;

  if (sheetComparisonData.includes(code)) {
    matchedCodes.add(code);
    localStorage.setItem("matchedCodes", JSON.stringify([...matchedCodes]));
  }
  renderComparisonTable();
}

// 📊 Render bảng so sánh
function renderComparisonTable() {
  const statsEl = document.getElementById('comparisonStats');
  const tableWrapper = document.getElementById('comparisonTableWrapper');
  const missingGrid = document.getElementById('missingCodesGrid');
  const allMatchedMsg = document.getElementById('allMatchedMessage');
  const badge = document.getElementById('comparisonBadge');
  const badgeText = document.getElementById('comparisonBadgeText');

  if (sheetComparisonData.length === 0) {
    statsEl.style.display = 'none';
    tableWrapper.style.display = 'none';
    badge.style.display = 'none';
    return;
  }

  const total = sheetComparisonData.length;
  const matched = matchedCodes.size;
  const missing = total - matched;

  // Tính các mã dư/ngoài danh sách
  const excessCodes = [...allReceivedCodes].filter(code => !sheetComparisonData.includes(code));
  const excess = excessCodes.length;

  // Update stats
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statMatched').textContent = matched;
  document.getElementById('statMissing').textContent = missing;
  document.getElementById('statExcess').textContent = excess;
  statsEl.style.display = 'flex';

  // Update badge
  badge.style.display = 'inline-flex';
  badgeText.textContent = `${missing} xót`;
  if (missing === 0) {
    badge.className = 'comparison-badge badge-success';
  } else {
    badge.className = 'comparison-badge badge-warning';
  }

  // Update missing count badge
  document.getElementById('missingCount').textContent = missing;

  // Show table wrapper
  tableWrapper.style.display = 'block';

  // Get missing codes
  const missingCodes = sheetComparisonData.filter(code => !matchedCodes.has(code));

  if (missingCodes.length === 0) {
    missingGrid.style.display = 'none';
    allMatchedMsg.style.display = 'flex';
  } else {
    missingGrid.style.display = 'grid';
    allMatchedMsg.style.display = 'none';

    missingGrid.innerHTML = missingCodes.map((code, index) => `
      <div class="missing-code-item" style="animation-delay: ${index * 0.03}s">
        <span class="missing-code-index">${index + 1}</span>
        <span class="missing-code-text">${escapeHtml(code)}</span>
        <span class="missing-code-badge">Chưa nhận</span>
      </div>
    `).join('');
  }

  // Render danh sách mã lưu dư
  const excessHeaderBar = document.getElementById('excessHeaderBar');
  const excessGrid = document.getElementById('excessCodesGrid');
  if (excessHeaderBar && excessGrid) {
    if (excess > 0) {
      excessHeaderBar.style.display = 'flex';
      excessGrid.style.display = 'grid';
      document.getElementById('excessCount').textContent = excess;
      excessGrid.innerHTML = excessCodes.map((code, index) => `
        <div class="missing-code-item" style="animation-delay: ${index * 0.03}s; background-color: rgba(245, 158, 11, 0.05); border-left-color: #f59e0b;">
          <span class="missing-code-index" style="background-color: #f59e0b; color: white;">${index + 1}</span>
          <span class="missing-code-text">${escapeHtml(code)}</span>
          <span class="missing-code-badge" style="background-color: rgba(245, 158, 11, 0.1); color: #d97706;">Dư/Ngoài DS</span>
        </div>
      `).join('');
    } else {
      excessHeaderBar.style.display = 'none';
      excessGrid.style.display = 'none';
    }
  }
}

// Utility: escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}