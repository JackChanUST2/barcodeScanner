const video = document.getElementById('video');
const statusText = document.getElementById('statusText');
const startScannerBtn = document.getElementById('startScannerBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');
const lastCodeEl = document.getElementById('lastCode');
const manualCodeInput = document.getElementById('manualCodeInput');
const saveManualBtn = document.getElementById('saveManualBtn');
const scanTableBody = document.getElementById('scanTableBody');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');

let codeReader = null;
let stream = null;
let scanHistory = [];

function setStatus(message) {
  statusText.textContent = message;
}

function formatTimestamp(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function saveScan(codeValue) {
  const normalized = String(codeValue).trim();

  if (!normalized) {
    return;
  }

  const item = {
    code: normalized,
    time: formatTimestamp(),
  };

  scanHistory = [item, ...scanHistory];
  lastCodeEl.textContent = normalized;
  renderHistory();
}

function renderHistory() {
  if (!scanHistory.length) {
    scanTableBody.innerHTML = '<tr><td colspan="2" class="empty-state">No barcodes saved yet.</td></tr>';
    return;
  }

  scanTableBody.innerHTML = scanHistory
    .map(
      (item) => `
        <tr>
          <td>${item.time}</td>
          <td>${item.code}</td>
        </tr>
      `
    )
    .join('');
}

function buildSpreadsheetData() {
  const rows = [['Time', 'Barcode']];

  scanHistory.forEach((item) => {
    rows.push([item.time, item.code]);
  });

  return rows;
}

function exportCsv() {
  if (!scanHistory.length) {
    setStatus('There are no scans to export yet.');
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(buildSpreadsheetData());
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const now = new Date();
  const stamp = new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-');

  link.href = URL.createObjectURL(blob);
  link.download = `barcode-scans-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('CSV spreadsheet downloaded.');
}

function exportExcel() {
  if (!scanHistory.length) {
    setStatus('There are no scans to export yet.');
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(buildSpreadsheetData());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scans');

  const now = new Date();
  const stamp = new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(workbook, `barcode-scans-${stamp}.xlsx`);
  setStatus('Excel spreadsheet downloaded.');
}

async function startScanner() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('This browser does not support camera access.');
    return;
  }

  try {
    setStatus('Requesting camera permission...');

    const devices = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
    const rearCamera = devices.find((device) => /rear|back|environment/i.test(device.label));
    const selectedDeviceId = rearCamera ? rearCamera.deviceId : devices[0]?.deviceId;

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        facingMode: 'environment',
      },
      audio: false,
    });

    video.srcObject = stream;
    video.play();

    if (!codeReader) {
      codeReader = new ZXing.BrowserMultiFormatReader();
    }

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.CODE_93,
      ZXing.BarcodeFormat.ITF,
    ]);

    await codeReader.decodeFromVideoDevice(selectedDeviceId, video, (result, error) => {
      if (result) {
        const decodedText = result.getText();
        saveScan(decodedText);
        setStatus(`Barcode read: ${decodedText}`);
      }

      if (error && error.name !== 'NotFoundException') {
        console.error(error);
      }
    }, hints);

    setStatus('Scanner is active. Point the camera at a barcode.');
  } catch (error) {
    console.error(error);
    setStatus('Could not start the camera. Please allow camera access and try again.');
  }
}

function stopScanner() {
  if (codeReader && typeof codeReader.reset === 'function') {
    codeReader.reset();
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (video) {
    video.srcObject = null;
  }

  setStatus('Scanner stopped.');
}

function addManualCode() {
  const value = manualCodeInput.value.trim();

  if (!value) {
    setStatus('Type a barcode value before saving.');
    return;
  }

  saveScan(value);
  manualCodeInput.value = '';
  setStatus(`Saved manual barcode: ${value}`);
}

startScannerBtn.addEventListener('click', startScanner);
stopScannerBtn.addEventListener('click', stopScanner);
saveManualBtn.addEventListener('click', addManualCode);
downloadCsvBtn.addEventListener('click', exportCsv);
downloadXlsxBtn.addEventListener('click', exportExcel);

renderHistory();
setStatus('Camera is ready when you start scanning.');
