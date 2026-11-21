// Key DOM references.
// These elements are the "live wiring" between the page and the browser logic.
const appVersionEl = document.getElementById('appVersion');
const video = document.getElementById('video');
const statusText = document.getElementById('statusText');
const debugText = document.getElementById('debugText');
const lastCodeEl = document.getElementById('lastCode');
const stockResultEl = document.getElementById('stockResult');
const startScannerBtn = document.getElementById('startScannerBtn');
const scanNowBtn = document.getElementById('scanNowBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');
const checkStockBtn = document.getElementById('checkStockBtn');
const addStockBtn = document.getElementById('addStockBtn');
const manualCodeInput = document.getElementById('manualCodeInput');
const useManualBtn = document.getElementById('useManualBtn');

// Current app version shown in the top header.
const APP_VERSION = '2.00';

// Important runtime variables:
// - codeReader: ZXing reader instance for live frame decoding.
// - stream: active camera stream from getUserMedia.
// - cameraReady: tells the app whether the camera is ready to decode.
// - scanAttempts: counts scan attempts for debug output.
let codeReader = null;
let stream = null;
let cameraReady = false;
let scannerRunning = false;
let scannerControls = null;
let latestDetectedCode = '';

if (appVersionEl) {
  appVersionEl.textContent = `v${APP_VERSION}`;
}

// Updates the user-facing status text in the status panel.
function setStatus(message) {
  statusText.textContent = message;
}

// Writes a short technical debug message used during troubleshooting.
function setDebug(message) {
  debugText.textContent = `Debug: ${message}`;
}

// Sets the latest detected barcode and updates the UI accordingly.
function setLatestCode(barcode) {
  const normalized = String(barcode || '').replace(/\s+/g, '').trim();
  if (!normalized) {
    return;
  }

  latestDetectedCode = normalized;
  lastCodeEl.textContent = normalized;
  stockResultEl.textContent = 'Barcode ready. Check stock or add stock.';
  setStatus(`Latest scan: ${normalized}`);
}

// Starts the camera stream and prepares the app for scanning.
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
    setDebug('requesting camera access via getUserMedia');

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    cameraReady = true;

    if (!codeReader) {
      if (typeof ZXing.BrowserMultiFormatReader === 'function') {
        codeReader = new ZXing.BrowserMultiFormatReader();
      } else {
        throw new Error('ZXing browser reader is not available.');
      }
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

    if (typeof codeReader.setHints === 'function') {
      codeReader.setHints(hints);
    }

    scannerRunning = true;
    const decodePromise = codeReader.decodeFromVideoDevice(undefined, video, (result, error) => {
      if (result) {
        setLatestCode(result.getText());
        setDebug(`latest detected=${latestDetectedCode}`);
        return;
      }

      if (error && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(error.name)) {
        setDebug(`search error: ${error.name || 'Error'} - ${error.message || 'unknown decode error'}`);
      }
    }, hints);

    if (decodePromise && typeof decodePromise.then === 'function') {
      decodePromise.then((controls) => {
        scannerControls = controls || null;
      }).catch((error) => {
        if (!scannerRunning) {
          return;
        }
        console.error(error);
        scannerRunning = false;
        cameraReady = false;
        setStatus('Barcode decoding stopped unexpectedly. Restart the camera.');
      });
    }

    setStatus('Camera started. Searching for barcodes...');
  } catch (error) {
    console.error(error);
    cameraReady = false;
    scannerRunning = false;
    scannerControls = null;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    if (video) {
      video.srcObject = null;
    }

    setStatus('Could not start the camera. Please allow camera access and try again.');
    setDebug(`camera start failed: ${error.name || 'Error'} - ${error.message || 'unknown camera error'}`);
  }
}

// Captures the latest detected code without saving, for immediate stock check.
function captureLatestCode() {
  if (!cameraReady || !stream || !video.srcObject) {
    setStatus('Start the camera first.');
    return;
  }

  if (!latestDetectedCode) {
    setStatus('No barcode detected yet. Keep the barcode in frame.');
    return;
  }

  setLatestCode(latestDetectedCode);
}

// Stops the live camera feed and clears the ZXing reader state.
function stopScanner() {
  cameraReady = false;
  scannerRunning = false;

  if (scannerControls && typeof scannerControls.stop === 'function') {
    try {
      scannerControls.stop();
    } catch (error) {
      console.error(error);
    }
  }
  scannerControls = null;

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
  setDebug('camera stopped; ready=false');
}

// Checks the stock for the latest scanned barcode.
async function checkStock() {
  if (!latestDetectedCode) {
    setStatus('There is no Latest scan yet.');
    return;
  }

  try {
    const response = await fetch('/api/stock/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: latestDetectedCode }),
    });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        stockResultEl.textContent = `Not found: ${latestDetectedCode}. Use Add Stock to create it.`;
      } else {
        stockResultEl.textContent = data.error || 'Could not check stock.';
      }
      return;
    }

    stockResultEl.textContent = `${data.name} — Remaining stock: ${data.quantity}`;
  } catch (error) {
    console.error(error);
    stockResultEl.textContent = 'Could not reach the stock service.';
  }
}

// Adds stock for the latest scanned barcode, or creates a new product if not found.
async function addStock() {
  if (!latestDetectedCode) {
    setStatus('There is no Latest scan yet.');
    return;
  }

  const quantityText = window.prompt('Enter quantity to add (1 to 9999):', '1');
  if (quantityText === null) {
    return;
  }

  if (!/^\d+$/.test(quantityText.trim())) {
    setStatus('Quantity must be a positive whole number from 1 to 9999.');
    return;
  }

  const quantity = Number(quantityText.trim());
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    setStatus('Quantity must be a positive whole number from 1 to 9999.');
    return;
  }

  let name = '';

  try {
    const checkResponse = await fetch('/api/stock/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: latestDetectedCode }),
    });

    if (checkResponse.status === 404) {
      name = window.prompt('This is a new barcode. Enter the product name:', '');
      if (name === null) {
        return;
      }
      name = name.trim();
      if (!name) {
        setStatus('A product name is required for new stock.');
        return;
      }
    }

    const response = await fetch('/api/stock/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: latestDetectedCode, quantity, name }),
    });
    const data = await response.json();

    if (!response.ok) {
      stockResultEl.textContent = data.error || 'Could not add stock.';
      return;
    }

    stockResultEl.textContent = `${data.name} — Remaining stock: ${data.quantity}`;
    setStatus(`Added ${quantity} item(s).`);
  } catch (error) {
    console.error(error);
    stockResultEl.textContent = 'Could not reach the stock service.';
  }
}

// Uses a manually entered barcode for stock checking or adding.
function useManualBarcode() {
  const barcode = manualCodeInput.value.replace(/\s+/g, '').trim();
  const validPattern = /^[A-Za-z0-9\-\.\/\+]+$/;

  if (!barcode) {
    setStatus('Enter a barcode before continuing.');
    return;
  }

  if (!validPattern.test(barcode)) {
    setStatus('Barcode contains unsupported characters.');
    return;
  }

  setLatestCode(barcode);
  manualCodeInput.value = '';
}

// Event wiring for the UI buttons.
startScannerBtn.addEventListener('click', startScanner);
scanNowBtn.addEventListener('click', captureLatestCode);
stopScannerBtn.addEventListener('click', stopScanner);
checkStockBtn.addEventListener('click', checkStock);
addStockBtn.addEventListener('click', addStock);
useManualBtn.addEventListener('click', useManualBarcode);

// Initial app state when the page first loads.
setStatus('Ready to scan. Stock data is temporary and resets when the host restarts.');
setDebug('initial state: page loaded, waiting for camera');
