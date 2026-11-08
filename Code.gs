/**
 * Code.gs - Database Google Sheets untuk Undian Spin MSQ Kabupaten
 *
 * CARA PASANG (sekali saja):
 * 1. Buat Google Sheets baru (kosong). Menu Ekstensi > Apps Script.
 * 2. Hapus isi default, tempel seluruh kode ini, lalu GANTI nilai TOKEN di bawah.
 * 3. Simpan, lalu Terapkan (Deploy) > Deployment baru > jenis "Aplikasi web".
 *    - Jalankan sebagai: Saya
 *    - Siapa yang memiliki akses: Siapa saja
 * 4. Izinkan akses saat diminta, lalu salin URL yang berakhiran /exec.
 * 5. Di aplikasi undian: Pengaturan > Sinkronisasi Google Sheets,
 *    tempel URL dan kode rahasia (TOKEN) yang sama, lalu "Simpan & hubungkan".
 *
 * Sheet yang dibuat otomatis:
 *  - Paket       : Babak | Kategori | Paket | Khat (pisahkan dengan koma). Boleh diedit langsung.
 *  - Pengaturan  : teks halaman, font, warna, PIN. Boleh diedit langsung.
 *  - Riwayat     : catatan setiap hasil undian (otomatis, jangan diedit).
 * Setelah mengubah Deployment kode, pilih "Kelola deployment" > edit > Versi baru.
 */
var TOKEN = 'GANTI_DENGAN_KODE_RAHASIA';

var UIK = ['bism','title','sub','rP','rF','btn','wait','ready','credit'];
var HP = ['Babak','Kategori','Paket','Khat'];
var HG = ['Kunci','Nilai'];
var HR = ['Waktu','Babak','Kategori','Paket','Khat','ID'];

function sh_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(head);
    s.getRange(1, 1, 1, head.length).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (((e && e.parameter && e.parameter.token) || '') !== TOKEN) return out_({ ok: false, err: 'token' });
  return out_({ ok: true, data: read_() });
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, err: 'json' }); }
  if (b.token !== TOKEN) return out_({ ok: false, err: 'token' });
  if (b.action === 'save') { write_(b.data); return out_({ ok: true }); }
  if (b.action === 'hist') { addHist_(b.h); return out_({ ok: true }); }
  return out_({ ok: false, err: 'aksi' });
}

function read_() {
  var cfg = {};
  sh_('Pengaturan', HG).getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0] !== '') cfg[String(r[0])] = r[1];
  });
  var rows = sh_('Paket', HP).getDataRange().getValues().slice(1);
  if (!rows.length && !Object.keys(cfg).length) return null;
  var rounds = { p: [], f: [] }, idx = {};
  rows.forEach(function (r) {
    if (!r[1] || !r[2]) return;
    var k = String(r[0]).toLowerCase().indexOf('f') === 0 ? 'f' : 'p';
    var key = k + '|' + r[1];
    if (!idx[key]) { idx[key] = { name: String(r[1]), pk: [] }; rounds[k].push(idx[key]); }
    idx[key].pk.push({
      n: String(r[2]),
      k: String(r[3]).split(',').map(function (x) { return x.trim(); }).filter(String)
    });
  });
  var ui = {};
  UIK.forEach(function (k) { if (cfg[k] !== undefined) ui[k] = String(cfg[k]); });
  var sty = { colors: [] };
  if (cfg.font) sty.font = String(cfg.font);
  if (cfg.tc) sty.tc = String(cfg.tc);
  for (var i = 1; i <= 6; i++) if (cfg['c' + i]) sty.colors.push(String(cfg['c' + i]));
  if (sty.colors.length < 6) delete sty.colors;
  return {
    updated: Number(cfg.updated) || 0,
    pin: String(cfg.pin || '1234'),
    ui: ui, sty: sty, rounds: rounds
  };
}

function write_(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var p = sh_('Paket', HP);
    p.getRange(2, 1, Math.max(1, p.getMaxRows() - 1), 4).clearContent();
    var rows = [];
    ['p', 'f'].forEach(function (k) {
      ((d.rounds || {})[k] || []).forEach(function (c) {
        (c.pk || []).forEach(function (x) {
          rows.push([k === 'f' ? 'Final' : 'Penyisihan', c.name, x.n, (x.k || []).join(', ')]);
        });
      });
    });
    if (rows.length) p.getRange(2, 1, rows.length, 4).setValues(rows);

    var g = sh_('Pengaturan', HG);
    g.getRange('B:B').setNumberFormat('@');
    g.getRange(2, 1, Math.max(1, g.getMaxRows() - 1), 2).clearContent();
    var kv = [['pin', d.pin], ['updated', d.updated]];
    UIK.forEach(function (k) { kv.push([k, (d.ui || {})[k]]); });
    var sty = d.sty || {};
    kv.push(['font', sty.font], ['tc', sty.tc]);
    (sty.colors || []).forEach(function (c, i) { kv.push(['c' + (i + 1), c]); });
    g.getRange(2, 1, kv.length, 2).setValues(kv.map(function (r) {
      return [r[0], r[1] == null ? '' : String(r[1])];
    }));
  } finally {
    lock.releaseLock();
  }
}

function addHist_(h) {
  if (!h) return;
  var s = sh_('Riwayat', HR);
  if (h.id && s.getLastRow() > 1) {
    var f = s.getRange(2, 6, s.getLastRow() - 1, 1).createTextFinder(String(h.id)).matchEntireCell(true).findNext();
    if (f) return; // sudah tercatat (cegah dobel)
  }
  s.appendRow([h.ts, h.r === 'f' ? 'Final' : 'Penyisihan', h.c, h.p, h.k, h.id]);
}

/** Dipanggil otomatis saat Sheet Paket/Pengaturan diedit manual, agar semua perangkat mengambil data terbaru. */
function onEdit(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name !== 'Paket' && name !== 'Pengaturan') return;
  var g = sh_('Pengaturan', HG);
  var v = g.getRange(1, 1, Math.max(1, g.getLastRow()), 1).getValues();
  for (var i = 1; i < v.length; i++) {
    if (v[i][0] === 'updated') {
      if (name === 'Pengaturan' && e.range.getRow() === i + 1) return;
      g.getRange(i + 1, 2).setValue(String(Date.now()));
      return;
    }
  }
}
