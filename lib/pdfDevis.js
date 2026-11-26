"use strict";
// Devis traiteur au format PDF (A4), joint aux e-mails. Générateur PDF écrit à la main, SANS dépendance :
// polices standard Helvetica (encodage WinAnsi : accents français et « € » compris), rectangles, traits,
// et le logo (lib/devis-logo.jpg, JPEG sur fond vert) intégré tel quel.
// buildDevisPdf(d, { logo }) → Uint8Array (Buffer sous Node). d = ligne de la table `devis`.

/* ------------------------- Polices et encodage ------------------------- */
// Largeurs Helvetica / Helvetica-Bold (unités 1/1000), caractères 32 à 126.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
// Caractères hors ASCII → code WinAnsi.
const WIN = { "€": 0x80, "‚": 0x82, "…": 0x85, "Œ": 0x8c, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c };
const SPECIAL_W = { 0x80: 556, 0x85: 1000, 0x8c: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x9c: 944, 0xab: 556, 0xbb: 556, 0xb7: 278, 0xd7: 584, 0xb0: 400, 0xa0: 278 };
const BASE = "AAAAAAACEEEEIIIIDNOOOOOxOUUUUYPsaaaaaaaceeeeiiiidnooooo/ouuuuypy"; // 0xC0..0xFF → lettre de base (largeur)

function code(ch) {
  const c = ch.charCodeAt(0);
  if (c === 0x202f || c === 0x2009 || c === 0x2007) return 0x20; // espaces fines (format des nombres en français)
  if (WIN[ch]) return WIN[ch];
  if (c < 256) return c;
  return 0x3f; // « ? » pour un caractère impossible à afficher
}
function charWidth(c, bold) {
  const t = bold ? W_BOLD : W_REG;
  if (c >= 32 && c <= 126) return t[c - 32];
  if (SPECIAL_W[c]) return SPECIAL_W[c];
  if (c >= 0xc0) return t[BASE.charCodeAt(c - 0xc0) - 32] || 556;
  return 556;
}
function textWidth(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) w += charWidth(code(ch), bold);
  return (w * size) / 1000;
}
function pdfString(s) {
  let out = "";
  for (const ch of String(s)) {
    const c = code(ch);
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += "\\" + String.fromCharCode(c);
    else if (c < 32 || c > 126) out += "\\" + c.toString(8).padStart(3, "0");
    else out += String.fromCharCode(c);
  }
  return "(" + out + ")";
}
function wrap(s, size, bold, maxW) {
  const lines = [];
  String(s == null ? "" : s).split(/\n/).forEach((para) => {
    let cur = "";
    para.split(/ +/).forEach((word) => {
      const test = cur ? cur + " " + word : word;
      if (textWidth(test, size, bold) <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = word; }
    });
    lines.push(cur);
  });
  return lines;
}

/* ------------------------- Document ------------------------- */
const PAGE_W = 595.28, PAGE_H = 841.89, M = 40;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(" "); };
const C = { vert: "#12574C", vert9: "#0E463D", creme: "#EDE0D3", creme4: "#F4ECE2", terre: "#B5651D", texte: "#1D252C", gris: "#5F6B74", ligne: "#E4DACD", blanc: "#FFFFFF" };

class Doc {
  constructor() { this.pages = []; this.newPage(); }
  newPage() { this.cur = []; this.pages.push(this.cur); this.y = M; }
  op(s) { this.cur.push(s); }
  text(x, y, s, o = {}) {
    const size = o.size || 10, bold = !!o.bold;
    let tx = x;
    if (o.align === "right") tx = x - textWidth(s, size, bold);
    else if (o.align === "center") tx = x - textWidth(s, size, bold) / 2;
    this.op("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + hex(o.color || C.texte) + " rg " + tx.toFixed(2) + " " + (PAGE_H - y - size * 0.8).toFixed(2) + " Td " + pdfString(s) + " Tj ET");
  }
  rect(x, y, w, h, color, radius) {
    this.op(hex(color) + " rg");
    if (!radius) { this.op(x.toFixed(2) + " " + (PAGE_H - y - h).toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re f"); return; }
    const r = radius, k = 0.5523 * r, X = x, Y = PAGE_H - y - h;
    this.op([
      (X + r) + " " + Y + " m", (X + w - r) + " " + Y + " l", (X + w - r + k) + " " + Y + " " + (X + w) + " " + (Y + r - k) + " " + (X + w) + " " + (Y + r) + " c",
      (X + w) + " " + (Y + h - r) + " l", (X + w) + " " + (Y + h - r + k) + " " + (X + w - r + k) + " " + (Y + h) + " " + (X + w - r) + " " + (Y + h) + " c",
      (X + r) + " " + (Y + h) + " l", (X + r - k) + " " + (Y + h) + " " + X + " " + (Y + h - r + k) + " " + X + " " + (Y + h - r) + " c",
      X + " " + (Y + r) + " l", X + " " + (Y + r - k) + " " + (X + r - k) + " " + Y + " " + (X + r) + " " + Y + " c", "f",
    ].join("\n").replace(/(\d+\.\d{3})\d+/g, "$1"));
  }
  line(x1, y1, x2, y2, color, width) {
    this.op(hex(color) + " RG " + (width || 0.6) + " w " + x1.toFixed(2) + " " + (PAGE_H - y1).toFixed(2) + " m " + x2.toFixed(2) + " " + (PAGE_H - y2).toFixed(2) + " l S");
  }
  image(name, x, y, w, h) {
    this.op("q " + w.toFixed(2) + " 0 0 " + h.toFixed(2) + " " + x.toFixed(2) + " " + (PAGE_H - y - h).toFixed(2) + " cm /" + name + " Do Q");
  }
  // Paragraphe sur plusieurs lignes ; renvoie la hauteur utilisée.
  para(x, y, s, maxW, o = {}) {
    const size = o.size || 10, lh = o.lh || size * 1.35;
    const lines = wrap(s, size, o.bold, maxW);
    lines.forEach((l, i) => this.text(x, y + i * lh, l, o));
    return lines.length * lh;
  }
  ensure(h, onNewPage) { if (this.y + h > PAGE_H - 60) { this.newPage(); if (onNewPage) onNewPage(); } }
}

/* ------------------------- Assemblage du fichier PDF ------------------------- */
function bytes(str) { const u = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; }
function concat(parts) {
  const len = parts.reduce((t, p) => t + p.length, 0), out = new Uint8Array(len);
  let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}
function jpegSize(u8) {
  let i = 2;
  while (i < u8.length) {
    if (u8[i] !== 0xff) { i++; continue; }
    const m = u8[i + 1], len = (u8[i + 2] << 8) + u8[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (u8[i + 5] << 8) + u8[i + 6], w: (u8[i + 7] << 8) + u8[i + 8], comps: u8[i + 9] };
    i += 2 + len;
  }
  return null;
}
function serialize(doc, logo) {
  const objs = []; // contenu de chaque objet (Uint8Array), numéro = index + 1
  const add = (u) => { objs.push(u); return objs.length; };
  const fontReg = add(bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  const fontBold = add(bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  let imgRef = null;
  const js = logo && jpegSize(logo);
  if (js) {
    imgRef = add(concat([bytes("<< /Type /XObject /Subtype /Image /Width " + js.w + " /Height " + js.h + " /ColorSpace /" + (js.comps === 1 ? "DeviceGray" : "DeviceRGB") +
      " /BitsPerComponent 8 /Filter /DCTDecode /Length " + logo.length + " >>\nstream\n"), logo, bytes("\nendstream")]));
  }
  const pagesRef = objs.length + 1; objs.push(null); // réservé
  const kids = [];
  doc.pages.forEach((ops) => {
    const content = ops.join("\n");
    const cRef = add(concat([bytes("<< /Length " + content.length + " >>\nstream\n"), bytes(content), bytes("\nendstream")]));
    kids.push(add(bytes("<< /Type /Page /Parent " + pagesRef + " 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] /Contents " + cRef + " 0 R /Resources << /Font << /F1 " + fontReg + " 0 R /F2 " + fontBold + " 0 R >>" +
      (imgRef ? " /XObject << /Logo " + imgRef + " 0 R >>" : "") + " >> >>")));
  });
  objs[pagesRef - 1] = bytes("<< /Type /Pages /Kids [" + kids.map((k) => k + " 0 R").join(" ") + "] /Count " + kids.length + " >>");
  const catalog = add(bytes("<< /Type /Catalog /Pages " + pagesRef + " 0 R >>"));
  const info = add(bytes("<< /Producer " + pdfString("Bistro Burger") + " /Title " + pdfString(doc.title || "Devis") + " >>"));

  const parts = [bytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  let offset = parts[0].length;
  const xref = [];
  objs.forEach((o, i) => {
    const head = bytes((i + 1) + " 0 obj\n"), tail = bytes("\nendobj\n");
    xref.push(offset);
    parts.push(head, o, tail);
    offset += head.length + o.length + tail.length;
  });
  let x = "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  xref.forEach((o) => { x += String(o).padStart(10, "0") + " 00000 n \n"; });
  x += "trailer\n<< /Size " + (objs.length + 1) + " /Root " + catalog + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + offset + "\n%%EOF\n";
  parts.push(bytes(x));
  return concat(parts);
}

/* ------------------------- Le devis ------------------------- */
const SOCIETE = {
  raison: "Brasserie Zone Avon, SARL au capital de 200 €", adresse: "ZAC Avon, Bretelle de la Plaine, 13120 Gardanne",
  telephone: "04 65 84 89 18", email: "brasserie.zone.avon@gmail.com", site: "bistroburgergardanne.com",
  siret: "981 082 969 00016", tva: "FR35981082969",
};
const TYPES = { particulier: "Particulier", entreprise: "Entreprise", association: "Association" };
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eur = (n) => money.format(Math.round((Number(n) || 0) * 100) / 100);
function dateFr(ymd, withDay) {
  if (!ymd) return "";
  const d = new Date(String(ymd).slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return String(ymd);
  const t = new Intl.DateTimeFormat("fr-FR", Object.assign({ timeZone: "Europe/Paris" }, withDay ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" })).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function buildDevisPdf(d, opts = {}) {
  const doc = new Doc();
  doc.title = "Devis " + d.numero + " - Bistro Burger";
  const c = d.contenu || {}, t = c.totaux || {}, lignes = c.lignes || [];
  const X0 = M, X1 = PAGE_W - M, WIDTH = X1 - X0;
  const hasLogo = !!(opts.logo && jpegSize(opts.logo));

  // En-tête vert
  doc.rect(0, 0, PAGE_W, 118, C.vert);
  if (hasLogo) doc.image("Logo", X0, 22, 86, 45.6);
  else doc.text(X0, 30, "BISTRO BURGER", { size: 20, bold: true, color: C.creme });
  doc.text(X0, 76, SOCIETE.adresse, { size: 8.5, color: C.creme });
  doc.text(X0, 88, SOCIETE.telephone + " · " + SOCIETE.email, { size: 8.5, color: C.creme });
  doc.text(X0, 100, SOCIETE.site, { size: 8.5, color: C.creme });
  doc.text(X1, 26, "DEVIS TRAITEUR", { size: 9, bold: true, color: C.creme, align: "right" });
  doc.text(X1, 40, d.numero, { size: 20, bold: true, color: C.blanc, align: "right" });
  doc.text(X1, 70, "Émis le " + dateFr(String(d.created_at || "").slice(0, 10)), { size: 9, color: C.creme, align: "right" });
  doc.text(X1, 83, "Valable jusqu'au " + dateFr(d.valide_jusqu), { size: 9, color: C.creme, align: "right" });
  doc.y = 136;

  // Client / Événement
  const colW = (WIDTH - 14) / 2;
  const clientLines = [d.nom, d.societe, d.siret ? "SIRET " + d.siret : "", TYPES[d.type_client] || "", d.telephone, d.email, d.facturation ? "Facturation : " + d.facturation : ""].filter(Boolean);
  const remise = d.mode === "livraison"
    ? "Livraison : " + [d.adresse, [d.code_postal, d.ville || d.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : "Retrait à la brasserie";
  const eventLines = [dateFr(d.date_evenement, true) + (d.heure ? " à " + d.heure : ""), d.convives + " convive" + (d.convives > 1 ? "s" : ""), remise];
  const measure = (arr) => arr.reduce((h, l) => h + wrap(l, 9.5, false, colW - 24).length * 12.8, 0);
  const boxH = Math.max(measure(clientLines), measure(eventLines)) + 34;
  [[X0, "CLIENT", clientLines], [X0 + colW + 14, "ÉVÉNEMENT", eventLines]].forEach(([x, title, arr]) => {
    doc.rect(x, doc.y, colW, boxH, C.creme4, 8);
    doc.text(x + 12, doc.y + 10, title, { size: 8, bold: true, color: C.vert });
    let yy = doc.y + 25;
    arr.forEach((l, i) => { yy += doc.para(x + 12, yy, l, colW - 24, { size: 9.5, bold: i === 0, lh: 12.8 }); });
  });
  doc.y += boxH + 20;

  // Tableau des lignes
  const cols = { qte: X1 - 190, pu: X1 - 128, tot: X1 - 52, tva: X1 };
  const head = () => {
    doc.text(X0, doc.y, "DÉSIGNATION", { size: 7.5, bold: true, color: C.gris });
    doc.text(cols.qte, doc.y, "QTÉ", { size: 7.5, bold: true, color: C.gris, align: "right" });
    doc.text(cols.pu, doc.y, "PU HT", { size: 7.5, bold: true, color: C.gris, align: "right" });
    doc.text(cols.tot, doc.y, "TOTAL HT", { size: 7.5, bold: true, color: C.gris, align: "right" });
    doc.text(cols.tva, doc.y, "TVA", { size: 7.5, bold: true, color: C.gris, align: "right" });
    doc.y += 13; doc.line(X0, doc.y, X1, doc.y, C.vert, 1.2); doc.y += 8;
  };
  head();
  const descW = cols.qte - X0 - 40;
  lignes.forEach((l) => {
    const nameLines = wrap(l.name + (l.ex ? " (prix d'exemple)" : ""), 10, true, descW);
    const det = (l.detail || []).reduce((a, s) => a.concat(wrap(s, 8.5, false, descW)), []);
    const h = nameLines.length * 13 + det.length * 11 + 10;
    doc.ensure(h, head);
    const y0 = doc.y;
    nameLines.forEach((s, i) => doc.text(X0, y0 + i * 13, s, { size: 10, bold: true }));
    det.forEach((s, i) => doc.text(X0, y0 + nameLines.length * 13 + i * 11, s, { size: 8.5, color: C.gris }));
    doc.text(cols.qte, y0, String(l.qty), { size: 10, align: "right" });
    doc.text(cols.pu, y0, eur(l.pu), { size: 10, align: "right" });
    doc.text(cols.tot, y0, eur(l.ht), { size: 10, align: "right" });
    doc.text(cols.tva, y0, l.tva + " %" + (l.tvaMix ? "*" : ""), { size: 10, align: "right" });
    doc.y = y0 + h - 4; doc.line(X0, doc.y, X1, doc.y, C.ligne, 0.6); doc.y += 8;
  });
  if (lignes.some((l) => l.tvaMix)) { doc.text(X0, doc.y, "* Ligne comprenant des options à un autre taux de TVA (détail dans les totaux).", { size: 8, color: C.gris }); doc.y += 14; }

  // Totaux
  const rows = [];
  if (t.remise) rows.push(["Remise (" + (t.codePromo || "") + ")", "− " + eur(t.remise) + " HT"]);
  if (t.livraison) rows.push([t.livraison.label, t.livraison.note || eur(t.livraison.ht) + " HT"]);
  rows.push(["Total HT", eur(d.total_ht)]);
  (t.tva || []).filter((r) => r.base).forEach((r) => rows.push(["TVA " + r.rate + " % (sur " + eur(r.base) + ")", eur(r.tva)]));
  doc.ensure(rows.length * 15 + 80);
  const TX = X1 - 250;
  doc.y += 4;
  rows.forEach((r) => { doc.text(TX, doc.y, r[0], { size: 9.5, color: C.gris }); doc.text(X1, doc.y, r[1], { size: 9.5, align: "right" }); doc.y += 15; });
  doc.line(TX, doc.y, X1, doc.y, C.vert, 1.2); doc.y += 7;
  doc.text(TX, doc.y, "Total TTC", { size: 13, bold: true, color: C.vert9 }); doc.text(X1, doc.y, eur(d.total_ttc), { size: 13, bold: true, color: C.vert9, align: "right" }); doc.y += 20;
  if (d.convives) { doc.text(TX, doc.y, "Soit par personne", { size: 8.5, color: C.gris }); doc.text(X1, doc.y, eur(t.parPersonneHt) + " HT · " + eur(t.parPersonneTtc) + " TTC", { size: 8.5, color: C.gris, align: "right" }); doc.y += 14; }
  doc.text(TX, doc.y, "Acompte à la commande (" + (t.acomptePct || 40) + " %)", { size: 9.5, bold: true, color: C.terre }); doc.text(X1, doc.y, eur(d.acompte) + " TTC", { size: 9.5, bold: true, color: C.terre, align: "right" }); doc.y += 26;

  // Remarques
  if (d.remarques) {
    const h = wrap(d.remarques, 9, false, WIDTH).length * 12 + 18;
    doc.ensure(h);
    doc.text(X0, doc.y, "REMARQUES", { size: 8, bold: true, color: C.vert }); doc.y += 13;
    doc.y += doc.para(X0, doc.y, d.remarques, WIDTH, { size: 9, lh: 12 }) + 10;
  }

  // Conditions
  const conds = [
    "Aucun devis n'est validé sans un échange préalable avec le gérant.",
    "La commande est confirmée par le règlement d'un acompte de " + (t.acomptePct || 40) + " % (" + eur(d.acompte) + " TTC), par virement bancaire ou carte bancaire au restaurant.",
    "Commande au moins 96 h avant l'événement. Devis valable jusqu'au " + dateFr(d.valide_jusqu) + ", sous réserve de disponibilité à la date demandée.",
    "Liste des allergènes sur demande. Photos non contractuelles. Annulation, modification du nombre de convives et solde : conditions convenues avec le gérant lors de l'échange, avant le règlement de l'acompte.",
  ];
  const ch = conds.reduce((h, s) => h + wrap(s, 8.5, false, WIDTH - 12).length * 11.5 + 3, 0) + 18;
  doc.ensure(ch + 110);
  doc.text(X0, doc.y, "CONDITIONS", { size: 8, bold: true, color: C.vert }); doc.y += 13;
  conds.forEach((s) => { doc.text(X0, doc.y, "•", { size: 8.5, color: C.gris }); doc.y += doc.para(X0 + 10, doc.y, s, WIDTH - 12, { size: 8.5, color: C.gris, lh: 11.5 }) + 3; });
  doc.y += 12;

  // Bon pour accord
  doc.rect(X0, doc.y, colW, 80, C.creme4, 8);
  doc.rect(X0 + colW + 14, doc.y, colW, 80, C.creme4, 8);
  doc.text(X0 + 12, doc.y + 10, "Date :", { size: 9, color: C.gris });
  doc.para(X0 + colW + 26, doc.y + 10, "Signature du client, précédée de la mention « Bon pour accord » :", colW - 24, { size: 9, color: C.gris, lh: 11.5 });
  doc.y += 92;

  // Pied de page sur chaque page
  const n = doc.pages.length;
  doc.pages.forEach((ops, i) => {
    doc.cur = ops;
    doc.line(X0, PAGE_H - 44, X1, PAGE_H - 44, C.ligne, 0.6);
    doc.text(PAGE_W / 2, PAGE_H - 38, "Bistro Burger · " + SOCIETE.raison + " · SIRET " + SOCIETE.siret + " · TVA " + SOCIETE.tva, { size: 7, color: C.gris, align: "center" });
    doc.text(PAGE_W / 2, PAGE_H - 28, SOCIETE.adresse + " · " + SOCIETE.telephone + " · CGV : " + SOCIETE.site + "/cgv.html · Page " + (i + 1) + " / " + n, { size: 7, color: C.gris, align: "center" });
  });

  const out = serialize(doc, hasLogo ? opts.logo : null);
  return typeof Buffer !== "undefined" ? Buffer.from(out) : out;
}

// Logo lu une seule fois sur le disque (Node uniquement).
let LOGO = null;
function loadLogo() {
  if (LOGO !== null) return LOGO || undefined;
  try { LOGO = new Uint8Array(require("fs").readFileSync(require("path").join(__dirname, "devis-logo.jpg"))); }
  catch { LOGO = false; }
  return LOGO || undefined;
}

// Pièce jointe prête pour Resend : { filename, content (base64) }. Ne lève jamais d'erreur.
function devisAttachment(d) {
  try {
    const pdf = buildDevisPdf(d, { logo: loadLogo() });
    return { filename: "Devis-" + d.numero + "-Bistro-Burger.pdf", content: Buffer.from(pdf).toString("base64") };
  } catch (e) {
    console.error("[pdfDevis] " + (e && e.message));
    return null;
  }
}

module.exports = { buildDevisPdf, devisAttachment, textWidth, wrap };
