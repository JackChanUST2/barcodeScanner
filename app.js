const startButton = document.getElementById('start-scan');
const video = document.getElementById('camera');
const status = document.getElementById('status');
const result = document.getElementById('barcode-result');

let stream;
let detector;
let scanning = false;

function setStatus(message) {
  status.textContent = message;
}

function setResult(value) {
  result.textContent = value;
}

function stopStream() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

async function scanLoop() {
  if (!scanning || !detector) {
    return;
  }

  try {
    const barcodes = await detector.detect(video);

    if (barcodes.length > 0) {
      const firstCode = barcodes[0].rawValue;
      setResult(firstCode);
      setStatus('Barcode detected.');
      scanning = false;
      startButton.textContent = 'Scan again';
      return;
    }
  } catch (error) {
    setStatus(`Scanner error: ${error.message}`);
    scanning = false;
    startButton.textContent = 'Try again';
    return;
  }

  requestAnimationFrame(scanLoop);
}

async function startScanning() {
  if (!('BarcodeDetector' in window)) {
    setStatus('Barcode scanning is not supported in this browser.');
    return;
  }

  try {
    if (!detector) {
      detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    }

    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });
      video.srcObject = stream;
      await video.play();
    }

    setStatus('Point the camera at a barcode.');
    setResult('Scanning...');
    scanning = true;
    startButton.textContent = 'Scanning...';
    requestAnimationFrame(scanLoop);
  } catch (error) {
    setStatus(`Unable to start camera: ${error.message}`);
    setResult('No barcode detected yet');
  }
}

startButton.addEventListener('click', () => {
  if (!scanning) {
    startScanning();
  }
});

window.addEventListener('beforeunload', stopStream);
