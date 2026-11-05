const video = document.getElementById('video');
const statusText = document.getElementById('statusText');
const lastCodeEl = document.getElementById('lastCode');
const scanTableBody = document.getElementById('scanTableBody');
const startScannerBtn = document.getElementById('startScannerBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');
const manualCodeInput = document.getElementById('manualCodeInput');
const saveManualBtn = document.getElementById('saveManualBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');

let codeReader = null;
let stream = null;
let scanHistory = [];

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
    setStatus('Unable to load the shared scan list.');
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

    await codeReader.decodeFromVideoDevice(selectedDeviceId, video, async (result, error) => {
      if (result) {
        const decodedText = result.getText();
        await saveScanToServer(decodedText);
      }

      if (error && error.name !== 'NotFoundException') {
        console.error(error);
      }
    }, hints);

    setStatus('Scanner active. Point the camera at a barcode.');
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
stopScannerBtn.addEventListener('click', stopScanner);
saveManualBtn.addEventListener('click', addManualCode);
downloadCsvBtn.addEventListener('click', exportCsv);
downloadXlsxBtn.addEventListener('click', exportExcel);

loadScans();
setStatus('Ready to scan.');
