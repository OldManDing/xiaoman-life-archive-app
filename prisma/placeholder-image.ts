/**
 * 生成演示用「照片占位图」。
 *
 * 背景：种子只写 recordMedia 行、不上传对象时，前端拿到的是 404，
 * 会退化成「照片暂时无法显示」兜底；而上传 1×1 像素又会被 object-fit:cover
 * 拉成一块纯黑，比兜底更难看。这里用 Node 内置 zlib 手写 PNG 编码，
 * 画一张柔和的暖色渐变 + 相机线稿占位图，不引入任何图像库依赖。
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer: Buffer): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
};

const encodePng = (width: number, height: number, rgb: Buffer): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // 每行前置一个 filter 字节（0 = None）
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { deflateSync } = require('node:zlib') as typeof import('node:zlib');

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 圆角矩形有向距离场（负值在内部） */
const sdRoundRect = (px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number) => {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
};

/**
 * 暖色渐变 + 两枚柔光 + 相机线稿，读起来像「照片占位」而不是破图。
 * 与 --nl-home-paper-deep(#eef0f4) / --nl-home-brand-soft(#fde8dd) 同色系。
 */
export const createPlaceholderPhotoPng = (width = 1200, height = 900): Buffer => {
  const rgb = Buffer.alloc(width * height * 3);
  const stroke = 15;

  const warm = { r: 0xf9, g: 0xef, b: 0xe7 };
  const cool = { r: 0xe7, g: 0xee, b: 0xf3 };
  const ink = { r: 0xc4, g: 0xae, b: 0x9e };
  const blobs = [
    { cx: width * 0.3, cy: height * 0.27, r: width * 0.13 },
    { cx: width * 0.74, cy: height * 0.72, r: width * 0.18 },
  ];

  const bodyCx = width / 2;
  const bodyCy = height * 0.53;
  const bodyHw = width * 0.125;
  const bodyHh = height * 0.13;
  const lensR = width * 0.048;
  // 取景凸起只压在机身上缘一点点，避免和镜头圆黏成"钥匙孔"
  const bumpCx = bodyCx;
  const bumpCy = bodyCy - bodyHh;
  const bumpHw = bodyHw * 0.3;
  const bumpHh = 24;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = clamp01((x / width + y / height) / 2);
      let r = mix(warm.r, cool.r, t);
      let g = mix(warm.g, cool.g, t);
      let b = mix(warm.b, cool.b, t);

      // 柔光圆斑
      for (const blob of blobs) {
        const d = Math.hypot(x - blob.cx, y - blob.cy) / blob.r;
        const a = 0.34 * clamp01(1 - d * d);
        if (a > 0) {
          r = mix(r, 255, a);
          g = mix(g, 255, a);
          b = mix(b, 255, a);
        }
      }

      // 相机线稿：机身 + 镜头 + 顶部取景凸起
      let cov = 0;
      cov = Math.max(cov, clamp01(stroke / 2 + 0.5 - Math.abs(sdRoundRect(x, y, bodyCx, bodyCy, bodyHw, bodyHh, 34))));
      cov = Math.max(cov, clamp01(stroke / 2 + 0.5 - Math.abs(Math.hypot(x - bodyCx, y - bodyCy) - lensR)));
      cov = Math.max(
        cov,
        clamp01(stroke / 2 + 0.5 - Math.abs(sdRoundRect(x, y, bumpCx, bumpCy, bumpHw, bumpHh, 20))),
      );

      if (cov > 0) {
        const a = cov * 0.82;
        r = mix(r, ink.r, a);
        g = mix(g, ink.g, a);
        b = mix(b, ink.b, a);
      }

      const i = (y * width + x) * 3;
      rgb[i] = Math.round(r);
      rgb[i + 1] = Math.round(g);
      rgb[i + 2] = Math.round(b);
    }
  }

  return encodePng(width, height, rgb);
};
