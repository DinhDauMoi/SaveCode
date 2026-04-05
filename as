/**
 * HỆ THỐNG LƯU MÃ ĐƠN – XUẤT PDF ĐẸP CHUẨN
 * Phiên bản 2025 - V2 (Render HTML chuẩn PDF)
 * + Thêm cột Thời gian (ẩn khi xuất PDF)
 */

function getProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
function setProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // --- Lưu hàng loạt mã đơn (từ buffer) ---
if (action === "batchSave" && e.postData) {
  const sheetName = getProperty_("currentSheet") || "Dữ liệu";
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["STT", "Mã Đơn - Số Chứng Từ", "Lý do", "Thời gian"]);
  }

  const data = JSON.parse(e.postData.contents);
  if (!Array.isArray(data) || data.length === 0)
    return ContentService.createTextOutput("Không có dữ liệu để lưu.");

  const lastRow = sheet.getLastRow();
  const now = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
  const rows = data.map((m, i) => [lastRow + i, m, "Móp", now]);
  sheet.getRange(lastRow + 1, 1, rows.length, 4).setValues(rows);
  return ContentService.createTextOutput(`Đã lưu ${rows.length} mã đơn.`);
}

  if (action === "newSheet" && e.parameter.name) {
    const newName = e.parameter.name.trim();
    if (!newName) return ContentService.createTextOutput("❌ Tên sheet không hợp lệ!");
    let sheet = ss.getSheetByName(newName);
    if (!sheet) {
      sheet = ss.insertSheet(newName);
      sheet.appendRow(["STT", "Mã Đơn - Số Chứng Từ", "Lý do", "Thời gian"]);
    }
    setProperty_("currentSheet", newName);
    return ContentService.createTextOutput(`✅ Đang dùng sheet "${newName}"`);
  }

  if (action === "getCurrentSheet") {
    return ContentService.createTextOutput(getProperty_("currentSheet") || "Dữ liệu");
  }

// --- Xuất PDF chuẩn (render HTML -> PDF) ---
if (action === "exportPDF" && e.parameter.sheetName) {
  const sheetName = e.parameter.sheetName;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return ContentService.createTextOutput("❌ Không tìm thấy sheet!");

  const data = sheet.getDataRange().getValues();

  // Loại bỏ cột "Thời gian" (cột cuối - index 3) trước khi tạo PDF
  const dataWithoutTime = data.map(row => row.slice(0, 3));

  const htmlContent = buildHTML_(dataWithoutTime, sheetName);

  // Render HTML đúng chuẩn PDF
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(800)
    .setHeight(1000);

  // Tạo blob PDF hợp lệ
  const blob = htmlOutput.getBlob().getAs("application/pdf").setName(`${sheetName}.pdf`);

  // Lưu PDF thật vào Drive
  const pdfFile = DriveApp.createFile(blob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Xóa file cũ nếu có
  const old = getProperty_('lastExportedPdfId');
  if (old) {
    try { DriveApp.getFileById(old).setTrashed(true); } catch(e){}
  }
  setProperty_('lastExportedPdfId', pdfFile.getId());

  // 🔗 Trả link xem trực tiếp PDF (chứ không ép tải)
  const fileId = pdfFile.getId();
  const viewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
  return ContentService.createTextOutput(viewUrl);
}
  return ContentService.createTextOutput("OK");
}
/**
 * Xử lý khi web gửi POST (lưu hàng loạt)
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents || "[]");
    if (!Array.isArray(data) || data.length === 0)
      return ContentService.createTextOutput("Không có dữ liệu để lưu.");

    const sheetName = getProperty_("currentSheet") || "Dữ liệu";
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["STT", "Mã Đơn - Số Chứng Từ", "Lý do", "Thời gian"]);
    }

    const lastRow = sheet.getLastRow();
    const now = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    const rows = data.map((m, i) => [lastRow + i, m, "Móp", now]);
    sheet.getRange(lastRow + 1, 1, rows.length, 4).setValues(rows);

    return ContentService.createTextOutput(`Đã lưu ${rows.length} mã đơn.`);
  } catch (err) {
    return ContentService.createTextOutput("❌ Lỗi batchSave: " + err);
  }
}


/**
 * Tạo HTML chia đôi bảng + canh giữa + header/footer
 */
function buildHTML_(data, sheetName) {
  const logoUrl = "https://static.ybox.vn/2019/5/3/1557280686880-8863079ccec42c9a75d5.jpg";
  const logoBlob = UrlFetchApp.fetch(logoUrl).getBlob();
  const logoBase64 = Utilities.base64Encode(logoBlob.getBytes());
  const logoSrc = `data:image/jpeg;base64,${logoBase64}`;
  // Tách đôi dữ liệu thành 2 cột (nếu nhiều hàng)
  const half = Math.ceil((data.length - 1) / 2);
  const col1 = [data[0]].concat(data.slice(1, 1 + half));
  const col2 = [data[0]].concat(data.slice(1 + half));

  const colHTML = (col) => `
    <table class="data">
      ${col.map((r, i) =>
        `<tr>${r.map(c => `<td>${i === 0 ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`
      ).join('')}
    </table>
  `;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
         
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .header img {
          width: 100px;
          height: auto;
          margin-bottom: 5px;
        }
        .header h3 {
          margin: 5px 0;
        }
        .tables {
          display: flex;
          justify-content: center;
          gap: 20px;
          text-align: center;
        }
        table.data {
          border-collapse: collapse;
          width: 48%;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #333;
          padding: 5px;
          text-align: center;
        }
        .footer {
          margin-top: 50px;
          display: flex;
          justify-content: space-around;
          font-weight: bold;
        }
        h2 {
          margin-top: 10px;
          margin-bottom: 10px;
        }
        .textr{
            padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="display:flex;text-align: center;justify-content: center;">
          <div>
            <img src="${logoSrc}" style="padding-right: 15px;width: 140px;" alt="Logo">
          </div>
          <div>
            <h3>CÔNG TY CỔ PHẦN DƯỢC PHẨM FPT LONG CHÂU</h3>
            <div>Địa chỉ: 379-381 Hai Bà Trưng, P.3, Q.3, TP HCM</div>
            <div class="textr">MST: 0315275368</div>
          </div>
        </div>
        <h2>BIÊN BẢN KIỂM KÊ HÀNG HÓA BỊ HƯ HỎNG</h2>
        <div class="textr">Hôm nay, .............. tháng .............. năm .............. tại Kho Tổng Long Châu.</div>
        <div class="textr">Bên giao hàng ..............................................................................................</div>
        <div class="textr"> - Ông (bà) ...................................................................................................</div>
        <div class="textr">Bên nhận hàng ..............................................................................................</div>
        <div class="textr"> - Ông (bà) ...................................................................................................</div>
        <div class="textr" style="text-align: left;">Cùng nhau kiểm kê hàng hóa bị hư hỏng do vận chuyển như sau :</div>
      </div>

      <div class="tables">
        ${colHTML(col1)}
        ${col2.length > 1 ? colHTML(col2) : ""}
      </div>
      <div class="textr">Biên bản này được lập thành 02 bản và có giá trị pháp lý như nhau, 01 bản lưu tại bên nhận, 01 bản đưa bên vận chuyển.</div>
      <div class="footer">
        
        <div>BÊN GIAO HÀNG</div>
        <div>BÊN NHẬN HÀNG</div>
      </div>
    </body>
  </html>`;
}
