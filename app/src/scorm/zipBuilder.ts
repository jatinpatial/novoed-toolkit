import { esc, type BrandKey } from "../brand/tokens";
import { SCORM_COMPS } from "../generators/registry";
import { genSCORMhtml } from "../generators/scorm/genSCORM";
import type { ComponentData } from "../types";

interface ZipFile {
  name: string;
  content: string;
}

export function createZip(files: ZipFile[]): Blob {
  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];

  function crc32(buf: Uint8Array): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  files.forEach((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    const local = new Uint8Array(
      ([] as number[]).concat(
        [0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0),
        u16(0), u16(0),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0),
      ),
    );
    const entry = new Uint8Array(local.length + nameBytes.length + dataBytes.length);
    entry.set(local, 0);
    entry.set(nameBytes, local.length);
    entry.set(dataBytes, local.length + nameBytes.length);
    localHeaders.push(entry);

    const central = new Uint8Array(
      ([] as number[]).concat(
        [0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0),
        u16(0), u16(0),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
        u32(0x20), u32(offset),
      ),
    );
    const centEntry = new Uint8Array(central.length + nameBytes.length);
    centEntry.set(central, 0);
    centEntry.set(nameBytes, central.length);
    centralHeaders.push(centEntry);
    offset += entry.length;
  });

  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(
    ([] as number[]).concat(
      [0x50, 0x4b, 0x05, 0x06], u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralSize), u32(centralOffset),
      u16(0),
    ),
  );

  const totalSize = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  localHeaders.forEach((h) => { result.set(h, pos); pos += h.length; });
  centralHeaders.forEach((h) => { result.set(h, pos); pos += h.length; });
  result.set(eocd, pos);
  return new Blob([result], { type: "application/zip" });
}

export function downloadSCORM(sel: string, data: ComponentData, brand: BrandKey): void {
  const title = data.title || SCORM_COMPS.find((c) => c.id === sel)?.n || "Activity";
  const htmlContent = genSCORMhtml(sel, data, brand);
  const imsXml =
    '<?xml version="1.0" encoding="UTF-8"?><manifest identifier="BCG_SCORM" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="org1"><organization identifier="org1"><title>' +
    esc(title) +
    '</title><item identifier="item1" identifierref="res1"><title>' +
    esc(title) +
    '</title></item></organization></organizations><resources><resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>';

  const blob = createZip([
    { name: "index.html", content: htmlContent },
    { name: "imsmanifest.xml", content: imsXml },
  ]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = title.replace(/\s+/g, "_") + "_SCORM.zip";
  a.click();
}
