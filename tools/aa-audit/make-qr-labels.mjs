// Builds a printable sheet of replacement QR labels, one per public work,
// pointing at xanoarmenter.com instead of artworkarchive.com.
//
// Each QR encodes the permanent short URL https://xanoarmenter.com/qr/<inventory #>
// (api/qr.js redirects it to the work's current page), so a renamed work or a
// redesigned site never needs a new label. Artfolio's admin (Reports → QR
// labels) prints the same labels with more size options.
//
//   npm i --no-save qrcode@1.5.4
//   node tools/aa-audit/make-qr-labels.mjs        -> docs/qr-labels.html
//
// Input is tools/aa-audit/aa-qr-map.csv (written by the AA migration audit).
// Open the HTML in a browser and print it; each label is 50 x 30 mm.
import { readFileSync, writeFileSync } from "node:fs";
import QRCode from "qrcode";

const here = new URL(".", import.meta.url);
const csv = readFileSync(new URL("aa-qr-map.csv", here), "utf8").trim().split("\n");
const parse = (line) => {
  const out = [];
  let cur = "", quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  return [...out, cur];
};
const [head, ...lines] = csv.map(parse);
const rows = lines.map((l) => Object.fromEntries(head.map((h, i) => [h, l[i]])));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const labels = [];
for (const r of rows.filter((r) => r.site_url)) {
  const url = `https://xanoarmenter.com/qr/${r.inventory_number}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  labels.push(`<div class="l" data-inv="${esc(r.inventory_number)}">${svg}<div><b>${esc(r.title)}</b><span>Xano Armenter</span><span>${esc(r.inventory_number)}</span><small>${esc(url.replace("https://", ""))}</small></div></div>`);
}

writeFileSync(new URL("../../docs/qr-labels.html", here), `<!doctype html><meta charset="utf-8"><title>QR labels</title>
<style>@page{size:A4;margin:10mm}body{font:9pt system-ui,sans-serif;margin:0;background:#fff;color:#000}
main{display:grid;grid-template-columns:repeat(3,50mm);gap:4mm}
.l{width:50mm;height:30mm;box-sizing:border-box;border:.2mm dashed #999;padding:2mm;display:flex;gap:2mm;break-inside:avoid}
.l svg{width:26mm;height:26mm;flex:none}.l div{display:flex;flex-direction:column;gap:.5mm;overflow:hidden}
.l b{font-size:8pt}.l span{font-size:7pt}.l small{font-size:5pt;word-break:break-all;margin-top:auto}</style>
<main>${labels.join("\n")}</main>\n`);
console.log(`${labels.length} labels -> docs/qr-labels.html`);
