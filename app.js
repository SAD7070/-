// ===== iDotMatrix Web Controller — App Logic =====

// --- State ---
let currentPanel = 'connection';
let clockStyle = 0;
let scores = [0, 0];
let canvasTool = 'pen';
let canvasPixels = [];
let canvasSize = 32;
let isDrawing = false;
let uploadedImageData = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initMiniGrid();
    initCanvas();
    initColorPalette();
    initDropZone();
});

// --- Toast ---
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = 'toast', 2500);
}

// --- Panel Navigation ---
function switchPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + name).classList.add('active');
    document.querySelector(`[data-panel="${name}"]`).classList.add('active');
    currentPanel = name;
}

// --- Connection ---
async function toggleConnection() {
    if (BLE.connected) {
        await BLE.disconnect();
        updateConnectionUI(false);
        showToast('تم فصل الاتصال', 'error');
        return;
    }
    try {
        setConnecting(true);
        await BLE.scan();
        await BLE.connect();
        updateConnectionUI(true);
        showToast('✅ تم الاتصال بـ ' + BLE.getDeviceName() + ' (' + BLE.getServiceName() + ')', 'success');
    } catch (e) {
        setConnecting(false);
        showToast('❌ ' + e.message, 'error');
    }
}

function setConnecting(state) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (state) { dot.className = 'status-dot connecting'; text.textContent = 'جاري الاتصال...'; }
}

function updateConnectionUI(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('connectBtnText');
    const info = document.getElementById('infoStatus');
    const dev = document.getElementById('infoDevice');
    const devName = document.getElementById('deviceName');
    const actionIcon = document.getElementById('connActionIcon');
    const actionText = document.getElementById('connActionText');

    if (connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'متصل';
        btn.textContent = 'فصل';
        info.textContent = 'متصل'; info.className = 'info-value badge badge-green';
        dev.textContent = BLE.getDeviceName() || '—';
        devName.textContent = BLE.getDeviceName();
        actionIcon.textContent = '🔌'; actionText.textContent = 'فصل الاتصال';
    } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'غير متصل';
        btn.textContent = 'اتصال';
        info.textContent = 'غير متصل'; info.className = 'info-value badge badge-red';
        dev.textContent = '—'; devName.textContent = 'لم يتم الاتصال';
        actionIcon.textContent = '📡'; actionText.textContent = 'بحث واتصال';
    }
}

function onBLEDisconnected() {
    updateConnectionUI(false);
    showToast('⚠️ انقطع الاتصال بالجهاز', 'error');
}

// --- Send helper ---
async function sendCommand(data, successMsg) {
    if (!BLE.connected) { showToast('❌ غير متصل بالجهاز', 'error'); return false; }
    try {
        if (Array.isArray(data)) {
            for (const d of data) { await BLE.send(d); await new Promise(r => setTimeout(r, 100)); }
        } else {
            await BLE.send(data);
        }
        if (successMsg) showToast(successMsg, 'success');
        return true;
    } catch (e) { showToast('❌ فشل الإرسال: ' + e.message, 'error'); return false; }
}

// --- Clock ---
function selectClockStyle(style, el) {
    clockStyle = style;
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
}

function sendClock() {
    const hex = document.getElementById('clockColor').value;
    const [r, g, b] = hexToRgb(hex);
    const date = document.getElementById('clockDate').checked;
    const h24 = document.getElementById('clock24h').checked;
    sendCommand(Protocol.setClock(clockStyle, date, h24, r, g, b), '🕐 تم تطبيق الساعة');
}

// --- Pixel Canvas ---
function initCanvas() {
    canvasSize = parseInt(document.getElementById('canvasSize').value);
    canvasPixels = Array.from({ length: canvasSize }, () => Array(canvasSize).fill('#000000'));
    drawCanvas();
}

function drawCanvas() {
    const canvas = document.getElementById('pixelCanvas');
    const displaySize = Math.min(500, window.innerWidth - 200);
    const pixelSize = Math.floor(displaySize / canvasSize);
    canvas.width = canvasSize * pixelSize;
    canvas.height = canvasSize * pixelSize;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            ctx.fillStyle = canvasPixels[y][x];
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
    }
    canvas.onmousedown = (e) => { isDrawing = true; paintPixel(e); };
    canvas.onmousemove = (e) => { if (isDrawing) paintPixel(e); };
    canvas.onmouseup = () => isDrawing = false;
    canvas.onmouseleave = () => isDrawing = false;
    canvas.ontouchstart = (e) => { e.preventDefault(); isDrawing = true; paintPixel(e.touches[0], canvas); };
    canvas.ontouchmove = (e) => { e.preventDefault(); if (isDrawing) paintPixel(e.touches[0], canvas); };
    canvas.ontouchend = () => isDrawing = false;
}

function paintPixel(e, canvasEl) {
    const canvas = canvasEl || document.getElementById('pixelCanvas');
    const rect = canvas.getBoundingClientRect();
    const pixelSize = canvas.width / canvasSize;
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    if (x < 0 || x >= canvasSize || y < 0 || y >= canvasSize) return;

    if (canvasTool === 'pen') {
        canvasPixels[y][x] = document.getElementById('drawColor').value;
    } else if (canvasTool === 'eraser') {
        canvasPixels[y][x] = '#000000';
    } else if (canvasTool === 'fill') {
        floodFill(x, y, canvasPixels[y][x], document.getElementById('drawColor').value);
    }
    drawCanvas();
}

function floodFill(x, y, target, replacement) {
    if (target === replacement) return;
    if (x < 0 || x >= canvasSize || y < 0 || y >= canvasSize) return;
    if (canvasPixels[y][x] !== target) return;
    canvasPixels[y][x] = replacement;
    floodFill(x + 1, y, target, replacement);
    floodFill(x - 1, y, target, replacement);
    floodFill(x, y + 1, target, replacement);
    floodFill(x, y - 1, target, replacement);
}

function setTool(tool) {
    canvasTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tool' + tool.charAt(0).toUpperCase() + tool.slice(1)).classList.add('active');
}

function clearCanvas() {
    canvasPixels = Array.from({ length: canvasSize }, () => Array(canvasSize).fill('#000000'));
    drawCanvas();
}

async function sendCanvas() {
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = canvasSize;
    outCanvas.height = canvasSize;
    const ctx = outCanvas.getContext('2d');
    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            ctx.fillStyle = canvasPixels[y][x];
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Pass to sendImage PNG converter
    uploadedImageData = outCanvas;
    window.uploadedFile = { type: 'image/png' };
    await sendImage();
}

function initColorPalette() {
    const colors = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
        '#ff6600', '#ff3399', '#9933ff', '#33ccff', '#66ff33', '#ffcc00', '#ff3333', '#3366ff',
        '#993300', '#006600', '#000066', '#660066', '#666666', '#999999', '#cccccc', '#333333'
    ];
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = '';
    colors.forEach(c => {
        const el = document.createElement('div');
        el.className = 'palette-color';
        el.style.background = c;
        el.onclick = () => document.getElementById('drawColor').value = c;
        palette.appendChild(el);
    });
}

// --- Text ---
async function sendText() {
    const text = document.getElementById('textInput').value;
    if (!text) { showToast('❌ اكتب نصاً أولاً', 'error'); return; }
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }

    showToast('📝 جاري إرسال النص...', 'success');
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const bitmaps = [];
        const separator = new Uint8Array([5, 255, 255, 255]);

        for (let i = 0; i < text.length; i++) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 16, 32);
            ctx.fillStyle = 'white';
            ctx.fillText(text[i], 8, 16);

            const imgData = ctx.getImageData(0, 0, 16, 32).data;
            const bitmap = new Uint8Array(64); // 32 rows * 2 bytes

            for (let y = 0; y < 32; y++) {
                for (let x = 0; x < 16; x++) {
                    if (imgData[(y * 16 + x) * 4] > 127) {
                        const byteIdx = y * 2 + (x < 8 ? 0 : 1);
                        const bitIdx = x % 8;
                        bitmap[byteIdx] |= (1 << bitIdx);
                    }
                }
            }
            bitmaps.push(separator);
            bitmaps.push(bitmap);
        }

        let totalBitmapLen = bitmaps.reduce((sum, b) => sum + b.length, 0);
        let bitmapsData = new Uint8Array(totalBitmapLen);
        let offset = 0;
        for (const b of bitmaps) { bitmapsData.set(b, offset); offset += b.length; }

        const numChars = text.length;
        const textMeta = new Uint8Array([0, 0, 0, 1, 1, 95, 1, 255, 255, 255, 0, 0, 0, 0]); // Marquee mode 1, White text
        textMeta[0] = numChars & 0xFF;
        textMeta[1] = (numChars >> 8) & 0xFF;

        const packet = new Uint8Array(textMeta.length + bitmapsData.length);
        packet.set(textMeta, 0); packet.set(bitmapsData, textMeta.length);

        const header = new Uint8Array([0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12]);
        const totalLen = packet.length + 16;
        header[0] = totalLen & 0xFF; header[1] = (totalLen >> 8) & 0xFF;

        const packLen = packet.length;
        header[5] = packLen & 0xFF; header[6] = (packLen >> 8) & 0xFF;
        header[7] = (packLen >> 16) & 0xFF; header[8] = (packLen >> 24) & 0xFF;

        const crc = Protocol.crc32(packet);
        header[9] = crc & 0xFF; header[10] = (crc >> 8) & 0xFF;
        header[11] = (crc >> 16) & 0xFF; header[12] = (crc >> 24) & 0xFF;

        const fullPayload = new Uint8Array(header.length + packet.length);
        fullPayload.set(header, 0); fullPayload.set(packet, header.length);

        const BLE_CHUNK = 512;
        for (let i = 0; i < fullPayload.length; i += BLE_CHUNK) {
            const chunk = fullPayload.slice(i, i + BLE_CHUNK);
            await BLE.writeChar.writeValueWithoutResponse(chunk);
            await new Promise(r => setTimeout(r, 50));
        }
        showToast('📝 تم إرسال النص!', 'success');
    } catch (e) { showToast('❌ فشل النص: ' + e.message, 'error'); }
}

// --- Image Upload ---
function initDropZone() {
    const zone = document.getElementById('dropZone');
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) processImageFile(e.dataTransfer.files[0]);
    });
}

function handleImageUpload(e) {
    if (e.target.files.length) processImageFile(e.target.files[0]);
}

function processImageFile(file) {
    if (!file.type.startsWith('image/')) { showToast('❌ ملف غير صالح', 'error'); return; }
    window.uploadedFile = file; // Global reference for original file type
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const size = parseInt(document.getElementById('imagePixelSize').value);
            const canvas = document.getElementById('imagePreviewCanvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, size, size);
            canvas.style.width = Math.min(256, size * 4) + 'px';
            canvas.style.height = Math.min(256, size * 4) + 'px';
            document.getElementById('imagePreviewArea').style.display = 'flex';
            uploadedImageData = canvas;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function sendImage() {
    if (!window.uploadedFile) { showToast('❌ اختر صورة/متحركة أولاً', 'error'); return; }
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }

    if (window.uploadedFile.type === 'image/gif') {
        return sendGif(window.uploadedFile);
    }

    showToast('📤 جاري رفع الصورة...', 'success');

    try {
        // Convert canvas to PNG bytes
        const blob = await new Promise(resolve => uploadedImageData.toBlob(resolve, 'image/png'));
        const arrayBuf = await blob.arrayBuffer();
        const pngData = new Uint8Array(arrayBuf);

        const CHUNK_DATA_SIZE = 4096;
        const numChunks = Math.ceil(pngData.length / CHUNK_DATA_SIZE);

        // Build payload with header (from jaku/idotmatrix format)
        // Python: idk = len(png_data) + len(png_chunks)
        const totalLen = pngData.length + numChunks;
        const lenView = new DataView(new Int16Array([totalLen]).buffer);
        const pngLenView = new DataView(new Int32Array([pngData.length]).buffer);

        // Create single payload with header + PNG data
        let fullPayload = new Uint8Array(0);

        for (let i = 0; i < pngData.length; i += CHUNK_DATA_SIZE) {
            const chunk = pngData.slice(i, i + CHUNK_DATA_SIZE);
            const isFirst = i === 0;

            const header = new Uint8Array([
                lenView.getUint8(0, true), lenView.getUint8(1, true),
                0, 0,
                isFirst ? 0 : 2
            ]);

            const pngLen = new Uint8Array([
                pngLenView.getUint8(0, true), pngLenView.getUint8(1, true),
                pngLenView.getUint8(2, true), pngLenView.getUint8(3, true)
            ]);

            const segment = new Uint8Array(header.length + pngLen.length + chunk.length);
            segment.set(header, 0);
            segment.set(pngLen, header.length);
            segment.set(chunk, header.length + pngLen.length);

            const newPayload = new Uint8Array(fullPayload.length + segment.length);
            newPayload.set(fullPayload, 0);
            newPayload.set(segment, fullPayload.length);
            fullPayload = newPayload;
        }

        // Send in 512-byte BLE chunks
        const BLE_CHUNK = 512;
        for (let i = 0; i < fullPayload.length; i += BLE_CHUNK) {
            const chunk = fullPayload.slice(i, i + BLE_CHUNK);
            await BLE.writeChar.writeValueWithoutResponse(chunk);
            await new Promise(r => setTimeout(r, 50));
        }

        showToast('🖼️ تم إرسال الصورة!', 'success');
    } catch (e) {
        showToast('❌ فشل الرفع: ' + e.message, 'error');
    }
}

async function sendGif(file) {
    showToast('📤 جاري رفع GIF...', 'success');
    try {
        const arrayBuf = await file.arrayBuffer();
        const gifData = new Uint8Array(arrayBuf);

        const header = new Uint8Array([255, 255, 1, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 5, 0, 13]);

        const lenView = new DataView(new Int32Array([gifData.length]).buffer);
        header.set([lenView.getUint8(0, true), lenView.getUint8(1, true), lenView.getUint8(2, true), lenView.getUint8(3, true)], 5);

        const crc = Protocol.crc32(gifData);
        const crcView = new DataView(new Int32Array([crc]).buffer);
        header.set([crcView.getUint8(0, true), crcView.getUint8(1, true), crcView.getUint8(2, true), crcView.getUint8(3, true)], 9);

        const CHUNK_SIZE = 4096;
        let fullPayload = new Uint8Array(0);

        for (let i = 0; i < gifData.length; i += CHUNK_SIZE) {
            const chunk = gifData.slice(i, i + CHUNK_SIZE);
            header[4] = (i > 0) ? 2 : 0;
            const chunkLen = chunk.length + 16;

            const chunkLenView = new DataView(new Int16Array([chunkLen]).buffer);
            header.set([chunkLenView.getUint8(0, true), chunkLenView.getUint8(1, true)], 0);

            const segment = new Uint8Array(16 + chunk.length);
            segment.set(header, 0);
            segment.set(chunk, 16);

            const newPayload = new Uint8Array(fullPayload.length + segment.length);
            newPayload.set(fullPayload, 0);
            newPayload.set(segment, fullPayload.length);
            fullPayload = newPayload;
        }

        const BLE_CHUNK = 512;
        for (let i = 0; i < fullPayload.length; i += BLE_CHUNK) {
            const chunk = fullPayload.slice(i, i + BLE_CHUNK);
            await BLE.writeChar.writeValueWithoutResponse(chunk);
            await new Promise(r => setTimeout(r, 50));
        }
        showToast('🖼️ تم إرسال الـ GIF!', 'success');
    } catch (e) {
        showToast('❌ فشل الرفع: ' + e.message, 'error');
    }
}



// --- Scoreboard ---
function changeScore(player, delta) {
    const idx = player - 1;
    scores[idx] = Math.max(0, Math.min(999, scores[idx] + delta));
    document.getElementById('score' + player).textContent = scores[idx];
}

function resetScores() {
    scores = [0, 0];
    document.getElementById('score1').textContent = '0';
    document.getElementById('score2').textContent = '0';
}

function sendScoreboard() {
    sendCommand(Protocol.scoreboard(scores[0], scores[1]), '🏆 تم إرسال النتائج');
}

// --- Timer ---
function switchTimerTab(tab, el) {
    document.getElementById('tab-countdown').style.display = tab === 'countdown' ? 'block' : 'none';
    document.getElementById('tab-stopwatch').style.display = tab === 'stopwatch' ? 'block' : 'none';
    document.querySelectorAll('.timer-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

function sendCountdown(mode) {
    showToast('⏳ فيه بروتوكول خاص للمؤقت — قيد التطوير', 'error');
}

function sendChronograph(mode) {
    showToast('⏱️ فيه بروتوكول خاص — قيد التطوير', 'error');
}

// --- Settings ---
function sendBrightness() {
    const val = parseInt(document.getElementById('brightness').value);
    sendCommand(Protocol.setBrightness(val), '💡 تم تعديل السطوع');
}

function sendScreenOn() { sendCommand(Protocol.screenOn(), '📺 تم تشغيل الشاشة'); }
function sendScreenOff() { sendCommand(Protocol.screenOff(), '📴 تم إيقاف الشاشة'); }
function sendFlipScreen() { sendCommand(Protocol.flipScreen(true), '🔄 تم قلب الشاشة'); }
function sendSyncTime() { sendCommand(Protocol.syncTime(), '⏰ تم مزامنة الوقت'); }

function sendFullscreenColor() {
    const hex = document.getElementById('fullColor').value;
    const [r, g, b] = hexToRgb(hex);
    sendCommand(Protocol.fullscreenColor(r, g, b), '🌈 تم تطبيق اللون');
}

function sendReset() {
    showToast('♻️ غير مدعوم — أطفئ الجهاز يدوياً', 'error');
}

// --- Mini Grid ---
function initMiniGrid() {
    const grid = document.getElementById('miniGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        const s = document.createElement('span');
        s.style.opacity = Math.random() * 0.5 + 0.1;
        grid.appendChild(s);
    }
}

// --- Helpers ---
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

// ===== DEBUG FUNCTIONS =====
function debugLog(msg) {
    const el = document.getElementById('debugLog');
    el.style.display = 'block';
    el.innerHTML += msg + '<br>';
    el.scrollTop = el.scrollHeight;
    console.log('[DEBUG]', msg);
}

// Send raw bytes directly via writeValueWithoutResponse
async function sendRaw(bytes) {
    const data = new Uint8Array(bytes);
    await BLE.writeChar.writeValueWithoutResponse(data);
}

async function testColor(r, g, b) {
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }
    debugLog('========= SERVICE: ' + BLE.getServiceName() + ' =========');

    // METHOD 1: Raw iDotMatrix bytes (from go-idot / python lib)
    // Fullscreen color: [7, 0, 2, 2, R, G, B]
    const raw1 = [7, 0, 2, 2, r, g, b];
    debugLog(`📤 [RAW] Fullscreen color: [${raw1}]`);
    try {
        await sendRaw(raw1);
        debugLog('✅ [RAW] Sent via writeValueWithoutResponse');
    } catch (e) { debugLog('❌ [RAW] ' + e.message); }

    await new Promise(resolve => setTimeout(resolve, 500));

    // METHOD 2: Raw screen ON
    const raw2 = [5, 0, 7, 1, 1];
    debugLog(`📤 [RAW] Screen ON: [${raw2}]`);
    try {
        await sendRaw(raw2);
        debugLog('✅ [RAW] Sent');
    } catch (e) { debugLog('❌ [RAW] ' + e.message); }

    await new Promise(resolve => setTimeout(resolve, 500));

    // METHOD 3: Raw Graffiti/pixel paint (from 8none1 research)
    // Draw a single pixel at 0,0: [10, 0, 5, 1, 0, R, G, B, x, y]
    const raw3 = [10, 0, 5, 1, 0, r, g, b, 0, 0];
    debugLog(`📤 [RAW] Graffiti pixel(0,0): [${raw3}]`);
    try {
        await sendRaw(raw3);
        debugLog('✅ [RAW] Sent');
    } catch (e) { debugLog('❌ [RAW] ' + e.message); }

    await new Promise(resolve => setTimeout(resolve, 500));

    // METHOD 4: Raw brightness 100%
    const raw4 = [5, 0, 4, 128, 100];
    debugLog(`📤 [RAW] Brightness 100%: [${raw4}]`);
    try {
        await sendRaw(raw4);
        debugLog('✅ [RAW] Sent');
    } catch (e) { debugLog('❌ [RAW] ' + e.message); }

    await new Promise(resolve => setTimeout(resolve, 500));

    // METHOD 5: Raw clock (from go-idot)
    // [8, 0, 6, 1, style|flags, R, G, B]
    const raw5 = [8, 0, 6, 1, 192, 255, 255, 255]; // style 0, date on (128), 24h (64)
    debugLog(`📤 [RAW] Clock: [${raw5}]`);
    try {
        await sendRaw(raw5);
        debugLog('✅ [RAW] Sent');
    } catch (e) { debugLog('❌ [RAW] ' + e.message); }

    await new Promise(resolve => setTimeout(resolve, 500));

    // METHOD 6: Divoom Timebox format (with 01-LEN-PAYLOAD-CRC-02 framing)
    const divoom = Protocol.solidColor(r, g, b, 100);
    debugLog(`📤 [DIVOOM] Solid color: [${Array.from(divoom).map(v => v.toString(16).padStart(2, '0')).join(' ')}]`);
    try {
        await sendRaw(Array.from(divoom));
        debugLog('✅ [DIVOOM] Sent');
    } catch (e) { debugLog('❌ [DIVOOM] ' + e.message); }

    debugLog('🔍 Did ANY of these change the display? Check screen!');
}

async function testScreenOn() {
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }
    debugLog('📤 [RAW] Screen ON: [5, 0, 7, 1, 1]');
    await sendRaw([5, 0, 7, 1, 1]);
    debugLog('✅ Sent');
}

async function testScreenOff() {
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }
    debugLog('📤 [RAW] Screen OFF: [5, 0, 7, 1, 0]');
    await sendRaw([5, 0, 7, 1, 0]);
    debugLog('✅ Sent');
}

async function testWriteMethod() {
    if (!BLE.connected) { showToast('❌ غير متصل', 'error'); return; }
    const char = BLE.writeChar;
    const props = char.properties;
    debugLog('=== CHAR PROPERTIES ===');
    debugLog(`UUID: ${char.uuid}`);
    debugLog(`write: ${props.write}, writeNoResp: ${props.writeWithoutResponse}`);

    // Test raw brightness with writeValueWithoutResponse
    debugLog('📤 Testing raw bytes via writeValueWithoutResponse...');
    const data = new Uint8Array([5, 0, 4, 128, 100]);
    try {
        await char.writeValueWithoutResponse(data);
        debugLog('✅ writeValueWithoutResponse OK');
    } catch (e) { debugLog('❌ ' + e.message); }

    // Wait and check for notification
    debugLog('📩 Waiting for response...');
    const resp = await BLE.waitForNotification(3000);
    if (resp) {
        debugLog('✅ Response: [' + Array.from(resp).map(v => v.toString(16).padStart(2, '0')).join(' ') + ']');
    } else {
        debugLog('⚠️ No response');
    }
}

async function testListChars() {
    if (!BLE.connected || !BLE.service) { showToast('❌ غير متصل', 'error'); return; }
    debugLog('=== CHARACTERISTICS ===');
    const chars = await BLE.service.getCharacteristics();
    for (const c of chars) {
        const p = c.properties;
        const flags = [];
        if (p.read) flags.push('R');
        if (p.write) flags.push('W');
        if (p.writeWithoutResponse) flags.push('WNR');
        if (p.notify) flags.push('N');
        debugLog(`  ${c.uuid} [${flags.join(',')}]`);
    }
}

