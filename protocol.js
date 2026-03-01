// ===== iDotMatrix Protocol — Raw Byte Format =====
// Confirmed working from python3-idotmatrix-library

const Protocol = {

    // Screen ON/OFF
    screenOn() { return new Uint8Array([5, 0, 7, 1, 1]); },
    screenOff() { return new Uint8Array([5, 0, 7, 1, 0]); },

    // Brightness: 5-100
    setBrightness(percent) {
        const val = Math.max(5, Math.min(100, percent));
        return new Uint8Array([5, 0, 4, 128, val]);
    },

    // Fullscreen color
    fullscreenColor(r, g, b) {
        return new Uint8Array([7, 0, 2, 2, r & 0xFF, g & 0xFF, b & 0xFF]);
    },

    // Clock mode (0-7), with optional date and 24h flag, color
    setClock(style, showDate, is24h, r, g, b) {
        let sb = style & 0x07;
        if (showDate) sb |= 128;
        if (is24h) sb |= 64;
        return new Uint8Array([8, 0, 6, 1, sb, r & 0xFF, g & 0xFF, b & 0xFF]);
    },

    // Set time
    setTime(year, month, day, weekDay, hour, minute, second) {
        return new Uint8Array([11, 0, 1, 128, year & 0xFF, month, day, weekDay, hour, minute, second]);
    },

    // Scoreboard
    scoreboard(score1, score2) {
        const s1 = Math.max(0, Math.min(999, score1));
        const s2 = Math.max(0, Math.min(999, score2));
        return new Uint8Array([
            8, 0, 10, 128,
            s1 & 0xFF, (s1 >> 8) & 0xFF,
            s2 & 0xFF, (s2 >> 8) & 0xFF
        ]);
    },

    // Graffiti mode — draw a pixel
    graffitiPixel(r, g, b, x, y) {
        return new Uint8Array([10, 0, 5, 1, 0, r & 0xFF, g & 0xFF, b & 0xFF, x, y]);
    },

    // Chronograph: 0=reset, 1=start, 2=pause, 3=continue
    chronograph(mode) {
        return new Uint8Array([5, 0, 9, 1, mode & 0x03]);
    },

    // Countdown: mode(0-3), minutes, seconds
    countdown(mode, minutes, seconds) {
        return new Uint8Array([7, 0, 8, 128, mode & 0x03, minutes, seconds]);
    },

    // Flip screen
    flipScreen(flip) {
        return new Uint8Array([5, 0, 3, 128, flip ? 1 : 0]);
    },

    // Freeze screen toggle
    freezeScreen() {
        return new Uint8Array([5, 0, 7, 2, 1]);
    },

    // --- Image/GIF upload helpers ---

    // Image mode: 0=off, 1=on
    imageMode(mode) {
        return new Uint8Array([5, 0, 5, mode ? 1 : 0, 0]);
    },

    // Build image upload payload from PNG bytes
    buildImagePayload(pngBytes) {
        const totalLen = pngBytes.length + 1; // +1 for chunk header
        const payloads = [];
        const CHUNK_SIZE = 4096;

        for (let i = 0; i < pngBytes.length; i += CHUNK_SIZE) {
            const chunk = pngBytes.slice(i, i + CHUNK_SIZE);
            const isFirst = i === 0;

            // Header: [totalLen(2 LE), 0, 0, chunkType]
            const header = new Uint8Array(5 + 4 + chunk.length);
            // Length (2 bytes LE)
            header[0] = totalLen & 0xFF;
            header[1] = (totalLen >> 8) & 0xFF;
            header[2] = 0;
            header[3] = 0;
            header[4] = isFirst ? 0 : 2; // 0 = first chunk, 2 = continuation

            // PNG total length (4 bytes LE)
            header[5] = pngBytes.length & 0xFF;
            header[6] = (pngBytes.length >> 8) & 0xFF;
            header[7] = (pngBytes.length >> 16) & 0xFF;
            header[8] = (pngBytes.length >> 24) & 0xFF;

            // Actual data
            header.set(chunk, 9);
            payloads.push(header);
        }
        return payloads;
    },

    // Sync current time
    syncTime() {
        const now = new Date();
        return this.setTime(
            now.getFullYear() & 0xFF,
            now.getMonth() + 1,
            now.getDate(),
            now.getDay(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds()
        );
    }
};

// CRC32 implementation for text and gif framing
Protocol.crc32 = function (data) {
    if (!this._crcTable) {
        this._crcTable = new Int32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            this._crcTable[i] = c;
        }
    }
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ this._crcTable[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
};
