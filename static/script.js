const video = document.getElementById('video');
const statusText = document.getElementById('statusText');
const lastCodeEl = document.getElementById('lastCode');
const scanTableBody = document.getElementById('scanTableBody');
const startScannerBtn = document.getElementById('startScannerBtn');
const scanNowBtn = document.getElementById('scanNowBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');
const manualCodeInput = document.getElementById('manualCodeInput');
const saveManualBtn = document.getElementById('saveManualBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');

let codeReader = null;
let stream = null;
let scanHistory = [];
let scanLock = false;
let cameraReady = false;

function setStatus(message) {
  statusText.textContent = message;
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
          <td>${item.created_at}</td>
          <td>${item.barcode}</td>
        </tr>
      `
    )
    .join('');
}

async function loadScans() {
  try {
    const response = await fetch('/api/scans');
    if (!response.ok) {
      throw new Error('Unable to load scans');
    }

    scanHistory = await response.json();
    if (scanHistory.length) {
      lastCodeEl.textContent = scanHistory[0].barcode;
    }
    renderHistory();
  } catch (error) {
    console.error(error);
    if (!scanHistory.length) {
      lastCodeEl.textContent = 'No scan yet';
    }
    if (statusText.textContent === 'Ready to scan.' || statusText.textContent === 'Camera is ready when you start scanning.') {
      setStatus('Ready to scan. Shared scan list will update when the server is available.');
    }
  }
}

async function saveScanToServer(barcode) {
  try {
    const response = await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Save failed');
    }

    setStatus(`Saved barcode: ${data.barcode}`);
    lastCodeEl.textContent = data.barcode;
    await loadScans();
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Could not save barcode.');
  }
}

function exportCsv() {
  if (!scanHistory.length) {
    setStatus('No scans to export yet.');
    return;
  }

  const rows = [['Time', 'Barcode']];
  scanHistory.forEach((item) => rows.push([item.created_at, item.barcode]));

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  link.href = URL.createObjectURL(blob);
  link.download = `barcode-scans-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('CSV exported.');
}

function exportExcel() {
  if (!scanHistory.length) {
    setStatus('No scans to export yet.');
    return;
  }

  const rows = [['Time', 'Barcode']];
  scanHistory.forEach((item) => rows.push([item.created_at, item.barcode]));

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scans');

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(workbook, `barcode-scans-${stamp}.xlsx`);
  setStatus('Excel exported.');
}

async function startScanner() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('This browser does not support camera access.');
    return;
  }

  if (stream && video.srcObject) {
    setStatus('Camera is already active.');
    return;
  }

  try {
    setStatus('Requesting camera permission...');

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    cameraReady = true;

    setStatus('Camera ready. Tap Scan Barcode to read the code.');
  } catch (error) {
    console.error(error);
    cameraReady = false;
    setStatus('Could not start the camera. Please allow camera access and try again.');
  }
}

async function scanNow() {
  if (!cameraReady || !stream || !video.srcObject) {
    setStatus('Start the camera first, then scan.');
    return;
  }

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
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

  try {
    setStatus('Scanning barcode...');
    const result = await codeReader.decodeOnceFromVideoElement(video, hints);

    if (!result) {
      setStatus('No barcode was visible in the frame. Move the camera closer and try again.');
      return;
    }

    const decodedText = String(result.getText()).trim();
    if (!decodedText) {
      setStatus('No barcode was visible in the frame. Move the camera closer and try again.');
      return;
    }

    await saveScanToServer(decodedText);
    setStatus(`Barcode read: ${decodedText}`);
  } catch (error) {
    console.error(error);
    setStatus('Scan failed while reading the frame. Try again or enter the barcode manually.');
  }
}

function stopScanner() {
  cameraReady = false;

  if (codeReader && typeof codeReader.reset === 'function') {
    try {
      codeReader.reset();
    } catch (error) {
      console.error(error);
    }
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

async function addManualCode() {
  const value = manualCodeInput.value.trim();
  if (!value) {
    setStatus('Type a barcode value before saving.');
    return;
  }

  manualCodeInput.value = '';
  await saveScanToServer(value);
}

startScannerBtn.addEventListener('click', startScanner);
scanNowBtn.addEventListener('click', scanNow);
stopScannerBtn.addEventListener('click', stopScanner);
saveManualBtn.addEventListener('click', addManualCode);
downloadCsvBtn.addEventListener('click', exportCsv);
downloadXlsxBtn.addEventListener('click', exportExcel);

loadScans();
setStatus('Ready to scan.');
