/**
 * Small shared helpers: timestamps, ID generation, locking, sheet access.
 */

function nowIso_() {
  return new Date().toISOString();
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet "' + name + '". Run setupSpreadsheet() first.');
  return sheet;
}

/**
 * Run `fn` while holding the script lock. Serialises ID generation and the
 * duplicate-check-then-insert sequence so concurrent requests can't interleave.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(10000);
  if (!acquired) throw apiError_('CONFLICT', 'The library is busy. Please try again.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function formatBookId_(n) {
  var s = String(n);
  while (s.length < 5) s = '0' + s;
  return 'BK-' + s;
}

function parseBookIdNumber_(id) {
  var m = /^BK-(\d+)$/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

/**
 * Generate the next Book ID from a persistent counter. Must be called while
 * holding the script lock. Deleted rows never cause reuse because the counter
 * only ever increases; as a belt-and-braces check we also skip any ID that
 * somehow already exists in the sheet.
 */
function nextBookId_(existingIds) {
  var props = getScriptProps_();
  var counter = Number(props.getProperty(PROP_KEYS.BOOK_ID_COUNTER) || 0);
  if (!isFinite(counter) || counter < 0) counter = 0;

  // Self-heal: if the counter is behind the sheet (e.g. property reset), catch up.
  var maxExisting = 0;
  for (var i = 0; i < existingIds.length; i++) {
    var n = parseBookIdNumber_(existingIds[i]);
    if (n > maxExisting) maxExisting = n;
  }
  if (maxExisting > counter) counter = maxExisting;

  var next = counter + 1;
  var id = formatBookId_(next);
  while (existingIds.indexOf(id) !== -1) {
    next += 1;
    id = formatBookId_(next);
  }
  props.setProperty(PROP_KEYS.BOOK_ID_COUNTER, String(next));
  mirrorSetting_('bookIdCounter', String(next));
  return id;
}

/** Best-effort mirror of a setting into the Settings sheet for visibility. */
function mirrorSetting_(key, value) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(SHEETS.SETTINGS);
    if (!sheet) return;
    var last = sheet.getLastRow();
    if (last >= 2) {
      var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === key) {
          sheet.getRange(i + 2, 2).setValue(value);
          return;
        }
      }
    }
    sheet.appendRow([key, value]);
  } catch (e) {
    Logger.log('mirrorSetting_ failed: ' + (e && e.message));
  }
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
