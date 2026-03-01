// ===== Web Bluetooth BLE Connection Manager =====
const BLE = {
    // === CORRECT UUIDS ===
    // Service 0x00FA (decimal 250) — the REAL iDotMatrix data service
    // NOT 0xFA00 (decimal 64000) which is wrong!
    IDOT_SERVICE: 0x00fa,
    IDOT_WRITE: '0000fa02-0000-1000-8000-00805f9b34fb',
    IDOT_READ: '0000fa03-0000-1000-8000-00805f9b34fb',

    // Jieli BLE chip service (firmware/OTA channel — NOT for display commands)
    JIELI_SERVICE: 0xae00,
    JIELI_WRITE: '0000ae01-0000-1000-8000-00805f9b34fb',
    JIELI_NOTIFY: '0000ae02-0000-1000-8000-00805f9b34fb',

    device: null,
    server: null,
    service: null,
    writeChar: null,
    notifyChar: null,
    connected: false,
    usedService: null,
    lastNotification: null,

    async scan() {
        try {
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    this.IDOT_SERVICE,    // 0x00FA — correct iDotMatrix service
                    this.JIELI_SERVICE,   // 0xAE00 — Jieli chip service
                    0xfa00,               // backup just in case
                    0xfff0,
                ]
            });
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());
            return this.device;
        } catch (e) {
            if (e.name === 'NotFoundError') throw new Error('لم يتم اختيار جهاز');
            throw e;
        }
    },

    async connect() {
        if (!this.device) throw new Error('لم يتم اختيار جهاز');
        this.server = await this.device.gatt.connect();

        // === STEP 1: Try iDotMatrix service FIRST (0x00FA) ===
        try {
            this.service = await this.server.getPrimaryService(this.IDOT_SERVICE);
            this.usedService = 'iDotMatrix (0x00FA)';
            console.log('✅ Found iDotMatrix service: 0x00FA');

            // Get FA02 write characteristic
            this.writeChar = await this.service.getCharacteristic(this.IDOT_WRITE);
            console.log('✅ Found write char: FA02');

            // Try to get FA03 read/notify characteristic
            try {
                this.notifyChar = await this.service.getCharacteristic(this.IDOT_READ);
                if (this.notifyChar.properties.notify || this.notifyChar.properties.read) {
                    if (this.notifyChar.properties.notify) {
                        await this.notifyChar.startNotifications();
                        this.notifyChar.addEventListener('characteristicvaluechanged', (event) => {
                            const value = new Uint8Array(event.target.value.buffer);
                            this.lastNotification = value;
                            console.log('📩 Notification:', Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
                        });
                        console.log('✅ Subscribed to notifications on FA03');
                    }
                }
            } catch (e) {
                console.log('ℹ️ FA03 not available:', e.message);
            }
        } catch (e) {
            console.log('⚠️ Service 0x00FA not found, trying 0xAE00...');

            // === STEP 2: Fallback to Jieli service (0xAE00) ===
            try {
                this.service = await this.server.getPrimaryService(this.JIELI_SERVICE);
                this.usedService = 'Jieli (0xAE00)';
                console.log('✅ Found Jieli service: 0xAE00');

                this.writeChar = await this.service.getCharacteristic(this.JIELI_WRITE);
                console.log('✅ Found write char: AE01');

                try {
                    this.notifyChar = await this.service.getCharacteristic(this.JIELI_NOTIFY);
                    if (this.notifyChar.properties.notify) {
                        await this.notifyChar.startNotifications();
                        this.notifyChar.addEventListener('characteristicvaluechanged', (event) => {
                            const value = new Uint8Array(event.target.value.buffer);
                            this.lastNotification = value;
                            console.log('📩 Notification:', Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
                        });
                        console.log('✅ Subscribed to notifications on AE02');
                    }
                } catch (e) {
                    console.log('ℹ️ AE02 not available:', e.message);
                }
            } catch (e2) {
                throw new Error('لم يتم العثور على أي خدمة بلوتوث مدعومة');
            }
        }

        if (!this.writeChar) throw new Error('لم يتم العثور على خاصية الكتابة');

        // Log which method to use
        const props = this.writeChar.properties;
        console.log(`📝 Write props: write=${props.write}, writeNoResp=${props.writeWithoutResponse}`);

        this.connected = true;
        console.log('✅ Connected to', this.device.name, 'via', this.usedService);
        return true;
    },

    async send(data) {
        if (!this.connected || !this.writeChar) throw new Error('غير متصل');
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const props = this.writeChar.properties;

        // Chunk size — default 20 but use larger if available
        const chunkSize = 512;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            if (props.writeWithoutResponse) {
                await this.writeChar.writeValueWithoutResponse(chunk);
            } else if (props.write) {
                await this.writeChar.writeValue(chunk);
            }
            // Small delay between chunks
            if (bytes.length > chunkSize) {
                await new Promise(r => setTimeout(r, 10));
            }
        }
    },

    async waitForNotification(timeoutMs = 2000) {
        this.lastNotification = null;
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (this.lastNotification) {
                    clearInterval(check);
                    resolve(this.lastNotification);
                }
            }, 50);
            setTimeout(() => { clearInterval(check); resolve(null); }, timeoutMs);
        });
    },

    async disconnect() {
        if (this.notifyChar) {
            try { await this.notifyChar.stopNotifications(); } catch (e) { }
        }
        if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
        this.connected = false;
    },

    onDisconnected() {
        this.connected = false;
        this.server = null; this.service = null;
        this.writeChar = null; this.notifyChar = null;
        if (typeof onBLEDisconnected === 'function') onBLEDisconnected();
    },

    getDeviceName() { return this.device ? this.device.name : null; },
    getServiceName() { return this.usedService || 'unknown'; }
};
