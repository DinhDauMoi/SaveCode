// Duong dan Web App
const API_URL =
  "https://script.google.com/macros/s/AKfycbxPagSUbCD-_Rfwvy8_pT33xgHkw7ythkH9f7ae_3mVJlnrAccUnzH-DqC4_onGm94j/exec";

const SEEN_KEY = "seenCodesV2";
let buffer = []; // luu tam cac ma chua gui
let isSyncing = false; // trang thai dong bo
const seenCodes = (() => {
  const safeParse = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const merged = new Set(
    safeParse(SEEN_KEY)
      .map((c) => String(c).trim().toUpperCase())
      .filter(Boolean)
  );

  // Xoa du lieu cu de tranh gay nham lan/bao trung sai
  localStorage.removeItem("seenTRHO");
  localStorage.removeItem("seenCodes");
  return merged;
})(); // luu cac ma da them de tranh trung lap

const rememberCode = (code) => {
  const upper = code.toUpperCase();
  seenCodes.add(upper);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seenCodes]));
};

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Xu ly danh sach ma can tim (co the an/hien)
const parseTargetCodes = () => {
  const textarea = document.getElementById("targetsInput");
  if (!textarea) return [];
  return textarea.value
    .split(/\n+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
};

const renderTargetCodes = (matchedSet = new Set()) => {
  const codes = parseTargetCodes();
  const display = document.getElementById("targetsDisplay");
  if (!display) return codes;
  display.innerHTML = codes
    .map((code) => {
      const isHit = matchedSet.has(code);
      return `<div class="${isHit ? "target-hit" : ""}">${escapeHtml(code)}</div>`;
    })
    .join("");
  return codes;
};

const showTargetContainer = (forceVisible) => {
  const container = document.getElementById("targetContainer");
  const toggleBtn = document.getElementById("toggleTargetInput");
  if (!container || !toggleBtn) return;

  const shouldShow =
    typeof forceVisible === "boolean"
      ? forceVisible
      : container.style.display === "none";

  container.style.display = shouldShow ? "block" : "none";
  toggleBtn.textContent = shouldShow ? "Ẩn ô tìm kiếm" : "Hiện ô tìm kiếm";
};

const getMatchedTargets = () => {
  const matched = new Set();
  parseTargetCodes().forEach((code) => {
    if (seenCodes.has(code)) matched.add(code);
  });
  return matched;
};

const updateTargetHighlights = () => {
  const matched = getMatchedTargets();
  renderTargetCodes(matched);
  if (matched.size) showTargetContainer(true);
};

const initTargetInput = () => {
  const textarea = document.getElementById("targetsInput");
  const toggleBtn = document.getElementById("toggleTargetInput");
  const container = document.getElementById("targetContainer");
  if (!textarea || !toggleBtn || !container) return;

  container.style.display = container.style.display || "none"; // an mac dinh
  toggleBtn.addEventListener("click", () => showTargetContainer());
  textarea.addEventListener("input", () => updateTargetHighlights());
  updateTargetHighlights();
};

function updateCurrentSheet() {
  fetch(`${API_URL}?action=getCurrentSheet`)
    .then((res) => res.text())
    .then(
      (name) => (document.getElementById("currentSheet").textContent = name)
    );
}

// Them ma vao bo nho tam
function saveMaDon() {
  const input = document.getElementById("maDon");
  const maDon = input.value.trim();
  if (!maDon) return;

  const upper = maDon.toUpperCase();
  if (seenCodes.has(upper)) {
    document.getElementById("message").textContent = `Trùng Mã: ${maDon} -> Không Lưu`;
    input.value = "";
    input.focus();
    return;
  }

  rememberCode(upper);

  buffer.push(maDon);
  input.value = "";
  input.focus();
  document.getElementById(
    "message"
  ).textContent = `Đã Thêm: ${maDon} (${buffer.length} Chưa Gửi)`;

  // Chi to mau/ hien o target, khong chan viec them
  try {
    updateTargetHighlights();
  } catch (err) {
    console.warn("Target highlight error:", err);
  }
}

// Tu dong gui du lieu 2s/lần
setInterval(async () => {
  if (isSyncing || buffer.length === 0) return;
  isSyncing = true;

  const batch = [...buffer];
  buffer = []; // lam rong truoc

  try {
    const res = await fetch(`${API_URL}?action=batchSave`, {
      method: "POST",
      body: JSON.stringify(batch),
    });
    const msg = await res.text();
    document.getElementById("message").textContent = `Info: ${msg}`;
  } catch (err) {
    // Neu loi, phuc hoi buffer
    localStorage.setItem("buffer", JSON.stringify(buffer));
    buffer = [...batch, ...buffer];
    document.getElementById("message").textContent =
      "Mạng Chậm, Thử Lại...";
  } finally {
    isSyncing = false;
  }
}, 2000);

// Nhan Enter de them vao buffer
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("maDon");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveMaDon();
    }
  });
  initTargetInput();
  updateCurrentSheet();
});

// Tao sheet moi
function createNewSheet() {
  const name = document.getElementById("newSheetName").value.trim();
  if (!name) return alert("Nhập Tên Sheet Cần Tạo!");
  fetch(`${API_URL}?action=newSheet&name=${encodeURIComponent(name)}`)
    .then((res) => res.text())
    .then((msg) => {
      document.getElementById("message").textContent = msg;
      updateCurrentSheet();
    })
    .catch((err) => alert("Có Lỗi: " + err));
}

// Xuat PDF
function exportPDF() {
  const sheetName = document.getElementById("sheetToExport").value.trim();
  if (!sheetName) return alert("Nhập Tên Sheet Cần Xuất PDF!");

  fetch(
    `${API_URL}?action=exportPDF&sheetName=${encodeURIComponent(sheetName)}`
  )
    .then((res) => res.text())
    .then((url) => {
      if (url.startsWith("https")) {
        window.open(url, "_blank");
      } else {
        document.getElementById("message").textContent = url;
      }
    })
    .catch((err) => alert("Có Lỗi: " + err));
}
