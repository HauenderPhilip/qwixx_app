/**
 * Minimaler MQTT-3.1.1-Client über WebSocket (nur QoS 0), ohne Abhängigkeiten.
 * Läuft überall, wo es `WebSocket` gibt: Browser, iOS und Android.
 *
 * Unterstützt: Verbinden mit „Last Will“, Abonnieren (inkl. Wildcards), Veröffentlichen
 * (auch „retained“), Keep-Alive und automatisches Wiederverbinden.
 */

export type MqttMessage = { topic: string; payload: string; retained: boolean };

export type MqttStatus = 'connecting' | 'connected' | 'disconnected';

export type MqttOptions = {
  urls: string[];
  clientId: string;
  keepAliveSeconds?: number;
  will?: { topic: string; payload: string; retain: boolean };
  onMessage: (message: MqttMessage) => void;
  onStatus: (status: MqttStatus) => void;
  /** Wird nach jedem (Wieder-)Verbinden aufgerufen, z. B. um den eigenen Stand erneut zu senden. */
  onConnect?: () => void;
};

const PACKET = {
  CONNECT: 0x10,
  CONNACK: 0x20,
  PUBLISH: 0x30,
  SUBSCRIBE: 0x82,
  SUBACK: 0x90,
  PINGREQ: 0xc0,
  PINGRESP: 0xd0,
  DISCONNECT: 0xe0,
};

export function utf8Encode(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return bytes;
}

export function utf8Decode(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let code: number;
    if (b < 0x80) {
      code = b;
      i += 1;
    } else if (b < 0xe0) {
      code = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b < 0xf0) {
      code = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      code =
        ((b & 7) << 18) |
        ((bytes[i + 1] & 63) << 12) |
        ((bytes[i + 2] & 63) << 6) |
        (bytes[i + 3] & 63);
      i += 4;
    }
    text += String.fromCodePoint(code);
  }
  return text;
}

function encodeLength(length: number): number[] {
  const bytes: number[] = [];
  do {
    let digit = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) digit |= 0x80;
    bytes.push(digit);
  } while (length > 0);
  return bytes;
}

function str(text: string): number[] {
  const bytes = utf8Encode(text);
  return [bytes.length >> 8, bytes.length & 255, ...bytes];
}

function packet(type: number, body: number[]): Uint8Array {
  return new Uint8Array([type, ...encodeLength(body.length), ...body]);
}

/** Zerlegt einen Byte-Strom in vollständige MQTT-Pakete; Reste bleiben für später. */
export function splitPackets(buffer: Uint8Array): { packets: Uint8Array[]; rest: Uint8Array } {
  const packets: Uint8Array[] = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    let multiplier = 1;
    let length = 0;
    let pos = offset + 1;
    let complete = false;
    while (pos < buffer.length && pos < offset + 5) {
      const digit = buffer[pos++];
      length += (digit & 127) * multiplier;
      multiplier *= 128;
      if ((digit & 0x80) === 0) {
        complete = true;
        break;
      }
    }
    if (!complete || pos + length > buffer.length) break;
    packets.push(buffer.slice(offset, pos + length));
    offset = pos + length;
  }
  return { packets, rest: buffer.slice(offset) };
}

/** Header-Länge (Typ-Byte + Längenfeld) eines vollständigen Pakets. */
function headerSize(p: Uint8Array): number {
  let pos = 1;
  while (p[pos] & 0x80) pos++;
  return pos + 1;
}

export class MqttClient {
  private ws: WebSocket | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private subscriptions = new Set<string>();
  private packetId = 1;
  private urlIndex = 0;
  private retryDelay = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private connected = false;
  private options: MqttOptions;

  constructor(options: MqttOptions) {
    this.options = options;
    this.open();
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(filter: string) {
    this.subscriptions.add(filter);
    if (this.connected) this.sendSubscribe(filter);
  }

  publish(topic: string, payload: string, retain = false) {
    if (!this.connected) return false;
    const body = [...str(topic), ...utf8Encode(payload)];
    this.send(packet(PACKET.PUBLISH | (retain ? 1 : 0), body));
    return true;
  }

  /** Sauber trennen: der „Last Will“ wird dabei nicht verschickt. */
  close() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.connected) this.send(new Uint8Array([PACKET.DISCONNECT, 0]));
    this.teardown();
    this.options.onStatus('disconnected');
  }

  private open() {
    if (this.closed) return;
    this.options.onStatus('connecting');
    const url = this.options.urls[this.urlIndex % this.options.urls.length];
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, ['mqtt']);
    } catch {
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    // Ohne Antwort innerhalb von 8 s gilt der Server als nicht erreichbar.
    const timeout = setTimeout(() => fail(), 8000);
    const fail = () => {
      clearTimeout(timeout);
      if (this.ws !== ws) return;
      const wasConnected = this.connected;
      this.teardown();
      if (this.closed) return;
      this.options.onStatus('disconnected');
      // Server, die nie verbunden haben, überspringen wir beim nächsten Versuch.
      if (!wasConnected) this.urlIndex++;
      this.scheduleReconnect();
    };
    ws.onopen = () => this.send(this.connectPacket());
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      if (this.receive(new Uint8Array(event.data))) clearTimeout(timeout);
    };
    ws.onerror = fail;
    ws.onclose = fail;
  }

  private connectPacket(): Uint8Array {
    const { clientId, will, keepAliveSeconds = 30 } = this.options;
    let flags = 0x02; // clean session
    if (will) flags |= 0x04 | (will.retain ? 0x20 : 0);
    const body = [
      ...str('MQTT'),
      4,
      flags,
      keepAliveSeconds >> 8,
      keepAliveSeconds & 255,
      ...str(clientId),
    ];
    if (will) body.push(...str(will.topic), ...str(will.payload));
    return packet(PACKET.CONNECT, body);
  }

  private sendSubscribe(filter: string) {
    const id = this.packetId++ & 0xffff || 1;
    this.send(packet(PACKET.SUBSCRIBE, [id >> 8, id & 255, ...str(filter), 0]));
  }

  /** Liefert true, sobald die Verbindung bestätigt ist. */
  private receive(chunk: Uint8Array): boolean {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    const { packets, rest } = splitPackets(merged);
    this.buffer = rest;
    for (const p of packets) this.handle(p);
    return this.connected;
  }

  private handle(p: Uint8Array) {
    const type = p[0] & 0xf0;
    const start = headerSize(p);
    if (type === PACKET.CONNACK) {
      if (p[start + 1] !== 0) {
        this.ws?.close();
        return;
      }
      this.connected = true;
      this.retryDelay = 1000;
      this.options.onStatus('connected');
      for (const filter of this.subscriptions) this.sendSubscribe(filter);
      const keepAlive = (this.options.keepAliveSeconds ?? 30) * 1000;
      this.pingTimer = setInterval(
        () => this.send(new Uint8Array([PACKET.PINGREQ, 0])),
        keepAlive * 0.8,
      );
      this.options.onConnect?.();
    } else if (type === PACKET.PUBLISH) {
      const qos = (p[0] >> 1) & 3;
      const topicLength = (p[start] << 8) | p[start + 1];
      const topic = utf8Decode(p.slice(start + 2, start + 2 + topicLength));
      const payloadStart = start + 2 + topicLength + (qos > 0 ? 2 : 0);
      const payload = utf8Decode(p.slice(payloadStart));
      this.options.onMessage({ topic, payload, retained: (p[0] & 1) === 1 });
    }
  }

  private send(data: Uint8Array) {
    // Als ArrayBuffer senden: das verstehen Browser und React Native gleichermaßen.
    if (this.ws?.readyState === 1) this.ws.send(data.buffer as ArrayBuffer);
  }

  private teardown() {
    this.connected = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.buffer = new Uint8Array(0);
    if (ws && ws.readyState <= 1) ws.close();
  }

  private scheduleReconnect() {
    if (this.closed) return;
    this.retryTimer = setTimeout(() => this.open(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 15000);
  }
}
