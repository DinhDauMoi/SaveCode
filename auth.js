// ============ AUTH MODULE ============
// Handles login, logout, and session management for SaveHO

const SESSION_KEY = 'saveho_session';

// ---- Check existing session on page load ----
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

function checkSession() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) {
    try {
      const data = JSON.parse(session);
      showMainApp(data.displayName || data.user);
    } catch (e) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
}

function showMainApp(displayName) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('displayName').textContent = displayName;
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

// ---- Toggle password visibility ----
function togglePassword() {
  const passInput = document.getElementById('loginPass');
  const eyeIcon = document.getElementById('eyeIcon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    passInput.type = 'password';
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// ---- Handle login submit ----
async function handleLogin(e) {
  e.preventDefault();

  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');
  const errorBox = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');
  const card = document.getElementById('loginCard');

  if (!user || !pass) return;

  // Show loading state
  btn.disabled = true;
  btnText.textContent = 'Đang xác thực...';
  spinner.style.display = 'block';
  errorBox.style.display = 'none';

  try {
    const url = `${API_URL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
    const res = await fetch(url);
    const text = await res.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { success: false, message: text };
    }

    if (result.success) {
      // Save session
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        user: user,
        displayName: result.displayName || user,
        loginTime: new Date().toISOString()
      }));
      showMainApp(result.displayName || user);
    } else {
      // Show error with shake
      errorText.textContent = result.message || 'Sai tài khoản hoặc mật khẩu';
      errorBox.style.display = 'flex';
      // Re-trigger shake animation
      errorBox.style.animation = 'none';
      errorBox.offsetHeight; // force reflow
      errorBox.style.animation = 'shakeError 0.4s ease';
    }
  } catch (err) {
    errorText.textContent = 'Lỗi kết nối. Kiểm tra mạng và thử lại.';
    errorBox.style.display = 'flex';
    errorBox.style.animation = 'none';
    errorBox.offsetHeight;
    errorBox.style.animation = 'shakeError 0.4s ease';
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Đăng Nhập';
    spinner.style.display = 'none';
  }
}

// ---- Handle logout ----
function handleLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  showLoginScreen();
  // Clear form
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').style.display = 'none';
}
