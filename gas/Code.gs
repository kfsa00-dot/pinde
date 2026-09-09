/**
 * 品德三冠王登記 — Apps Script 後端
 * 光復國小學務處
 *
 * 用途：提供一頁式登記網頁，老師填完按「送出」即寫入
 *      「品德三冠王評分」表單原本的回應試算表。
 *
 * 部署設定（很重要）：
 *   執行身分：我（表單擁有者 kfsa00@kfps.tp.edu.tw）
 *   誰可以存取：機構內任何人（或「知道連結的任何人」，但建議限機構內）
 *
 * 部署前請先執行一次 diagnose()，確認欄位對應正確。
 */

// 表單的編輯用 ID（網址 /forms/d/<這一段>/edit）
const FORM_ID = '1jGPnMreZXfngPsDUeCMkOWvSb59AaBtx7NgTy-BuyUc';

// 本學期登記要寫進哪一張工作表。
// 這張表不存在時會自動建立，標題列直接沿用「表單回覆 1」，欄位完全一致。
// 換學期時只要改這一行（例如下學期改成 '115-2'），上學期的資料就原封不動留著。
const SHEET_NAME = '115-1';

// 各題在表單裡的 item ID。改動表單題目「順序」不影響，
// 但如果把題目刪掉重建，ID 會變，要回來更新這裡。
const ITEM = {
  name: 1155529331,   // 請問您的姓名(教職員工)
  category: 624330656 // 評分項目
};

// 三個評分項目 → 各自的「選項(加/扣分)」題、班級座號題、行為項目題
const BRANCH = {
  walk: {
    label: '行儀楷模',
    value: '行儀楷模(放學路隊.學生禮儀)',
    modeItem: 1313887528,
    plus:  { sidItem: 1623980917, listItem: 59620950 },
    minus: { sidItem: 1614274716, listItem: 944311641 }
  },
  self: {
    label: '自律典範',
    value: '自律典範(自習時間)(上下課時間)',
    modeItem: 17253429,
    plus:  { sidItem: 59038923,  listItem: 1281612808 },
    minus: { sidItem: 818302086, listItem: 858027404 }
  },
  clean: {
    label: '整潔實踐',
    value: '整潔實踐(打掃時間.整潔狀況)',
    modeItem: 1064778219,
    plus:  { sidItem: 796564580, listItem: 453715882 },
    minus: { sidItem: 745741226, listItem: 582319264 }
  }
};

// 允許寫入的行為項目（防止有人自行帶入奇怪的值）
const OPTIONS = {
  walk:  { plus: ['有兩兩排好路隊', '慢步行走', '有禮貌'],
           minus: ['邊走邊飲食', '邊走邊聊天', '奔跑', '硬闖交通棍'] },
  self:  { plus: ['保持安靜', '安全遊戲'],
           minus: ['自習時間吵鬧', '自習時間玩樂', '自習時間奔跑', '走廊奔跑', '走廊打球',
                   '淋雨', '邊走邊飲食', '亂丟垃圾', '做危險動作(例如：跨跳欄杆.跳樓梯)'] },
  clean: { plus: ['主動隨手撿校園垃圾', '認真打掃'],
           minus: ['邊打掃邊玩，沒打掃乾淨', '打掃時間玩'] }
};


/* ===================== 網頁 ===================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('品德三冠王登記')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 網頁載入時取得目前登入者，顯示在畫面上。 */
function getViewer() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  return { email: email };
}


/* ===================== 寫入 ===================== */

/**
 * 由網頁呼叫。payload = { name, cat, mode, sid, items[] }
 * 回傳 { ok:true, row:<列號> } 或丟出錯誤訊息給前端顯示。
 */
function submitRecord(payload) {
  var name = String(payload && payload.name || '').trim();
  var catKey = String(payload && payload.cat || '');
  var mode = String(payload && payload.mode || '');
  var sid = String(payload && payload.sid || '').trim();
  var items = (payload && payload.items) || [];

  if (!name) throw new Error('請填寫您的姓名。');
  if (!BRANCH[catKey]) throw new Error('評分項目不正確，請重新選擇。');
  if (mode !== 'plus' && mode !== 'minus') throw new Error('請選擇加分或扣分。');
  if (!sid) throw new Error('請填寫學生班級座號。');
  if (!items.length) throw new Error('請至少選擇一個項目。');
  if (name.length > 30 || sid.length > 40) throw new Error('姓名或班級座號過長，請確認後再送出。');

  var allowed = OPTIONS[catKey][mode];
  var clean = items.map(function (v) {
    v = String(v).trim();
    if (allowed.indexOf(v) > -1) return v;
    if (v.length > 100) v = v.substring(0, 100);   // 「其他」自填內容
    return v;
  }).filter(function (v) { return v; });
  if (!clean.length) throw new Error('請至少選擇一個項目。');

  var branch = BRANCH[catKey];
  var leg = branch[mode];

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = getContext_();
    var row = new Array(ctx.headers.length).fill('');

    row[0] = new Date();                                   // 時間戳記
    if (ctx.emailCol >= 0) row[ctx.emailCol] = viewerEmail_();

    setCell_(row, ctx.map, ITEM.name, name);
    setCell_(row, ctx.map, ITEM.category, branch.value);
    setCell_(row, ctx.map, branch.modeItem, mode === 'plus' ? '加分' : '扣分');
    setCell_(row, ctx.map, leg.sidItem, sid);
    setCell_(row, ctx.map, leg.listItem, clean.join(', '));

    ctx.sheet.appendRow(row);
    SpreadsheetApp.flush();

    return {
      ok: true,
      row: ctx.sheet.getLastRow(),
      summary: sid + '　' + branch.label + (mode === 'plus' ? ' 加分' : ' 扣分') + '・' + clean.join('、')
    };
  } finally {
    lock.releaseLock();
  }
}

function setCell_(row, map, itemId, value) {
  var c = map[itemId];
  if (c === undefined) {
    throw new Error('找不到題目 ' + itemId + ' 對應的欄位，請執行 diagnose() 檢查表單是否被改過。');
  }
  row[c] = value;
}

function viewerEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}


/* ===================== 欄位對應 ===================== */

/**
 * 建立「表單題目 ID → 試算表欄位」的對照表。
 * 試算表欄位順序 = 時間戳記 [+ 電子郵件地址] + 表單題目依序排列，
 * 所以直接照 form.getItems() 的順序推算，之後表單新增題目也會自動跟上。
 */
function getContext_() {
  var form = FormApp.openById(FORM_ID);
  var ssId = form.getDestinationId();
  if (!ssId) throw new Error('這份表單沒有連結回應試算表，請先在表單的「回覆」分頁建立試算表。');

  var ss = SpreadsheetApp.openById(ssId);
  var source = pickSheet_(ss, form.getTitle());          // 欄位定義來源：表單原本的回應工作表
  var headers = source.getRange(1, 1, 1, source.getLastColumn()).getValues()[0];
  var sheet = getSemesterSheet_(ss, headers);            // 實際寫入：本學期的工作表

  var emailCol = -1;
  for (var i = 0; i < Math.min(headers.length, 3); i++) {
    if (String(headers[i]).indexOf('電子郵件') > -1) { emailCol = i; break; }
  }
  var offset = (emailCol >= 0 ? emailCol + 1 : 1);

  var skip = [FormApp.ItemType.PAGE_BREAK, FormApp.ItemType.SECTION_HEADER,
              FormApp.ItemType.IMAGE, FormApp.ItemType.VIDEO];
  var questions = form.getItems().filter(function (it) {
    return skip.indexOf(it.getType()) === -1;
  });

  var map = {};
  questions.forEach(function (it, i) { map[it.getId()] = offset + i; });

  return { sheet: sheet, source: source, headers: headers, emailCol: emailCol, map: map, questions: questions };
}

/**
 * 取得本學期的工作表，沒有就照著標題列建一張新的。
 * 這樣上學期的資料留在原本的回應工作表，本學期從零開始算。
 */
function getSemesterSheet_(ss, headers) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange('A2:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  }
  return sheet;
}

/** 找出表單回應所在的工作表；優先用名稱含「表單回應」的那張。 */
function pickSheet_(ss, formTitle) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName();
    if (n.indexOf('表單回應') === 0 || n === formTitle || n.indexOf('Form Responses') === 0) {
      return sheets[i];
    }
  }
  return sheets[0];
}


/* ===================== 檢查工具 ===================== */

/**
 * 部署前先跑這一支，看執行紀錄。
 * 每一行應該是「題目 → 對應到的試算表欄標題」，兩邊文字要一致。
 */
function diagnose() {
  var ctx = getContext_();
  var lines = [];
  lines.push('試算表：' + ctx.sheet.getParent().getName());
  lines.push('欄位定義來源：' + ctx.source.getName() + '（' + (ctx.source.getLastRow() - 1) + ' 筆，上學期資料）');
  lines.push('本學期寫入：' + ctx.sheet.getName() + '（' + (ctx.sheet.getLastRow() - 1) + ' 筆）');
  lines.push('電子郵件欄：' + (ctx.emailCol >= 0 ? String.fromCharCode(65 + ctx.emailCol) : '（無）'));
  lines.push('');
  ctx.questions.forEach(function (it) {
    var c = ctx.map[it.getId()];
    lines.push(pad_(it.getTitle(), 24) + ' → ' + colName_(c) + '欄「' + ctx.headers[c] + '」'
               + (it.getTitle() === String(ctx.headers[c]) ? '  ✓' : '  ⚠ 不一致'));
  });
  lines.push('');
  lines.push('程式用到的題目 ID 是否都找得到：');
  var need = [ITEM.name, ITEM.category];
  Object.keys(BRANCH).forEach(function (k) {
    need.push(BRANCH[k].modeItem, BRANCH[k].plus.sidItem, BRANCH[k].plus.listItem,
              BRANCH[k].minus.sidItem, BRANCH[k].minus.listItem);
  });
  need.forEach(function (id) {
    lines.push('  ' + id + ' → ' + (ctx.map[id] !== undefined ? colName_(ctx.map[id]) + '欄  ✓' : '找不到  ✗'));
  });
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

function pad_(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

function colName_(i) {
  var s = '';
  i = i + 1;
  while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
