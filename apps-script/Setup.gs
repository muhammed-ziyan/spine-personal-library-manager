/**
 * One-time setup helpers. Run `setupSpreadsheet` from the Apps Script editor
 * after binding the script to (or configuring) your spreadsheet.
 *
 * Safe to re-run: existing sheets and data are left untouched; only missing
 * tabs, headers and default genres are created.
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet_();

  var books = ensureSheet_(ss, SHEETS.BOOKS, headersFor_(BOOK_COLUMNS));
  // Keep ISBNs and text columns as plain text so leading zeros/apostrophes survive.
  books.getRange(1, 1, books.getMaxRows(), BOOK_COLUMNS.length).setNumberFormat('@');

  var genres = ensureSheet_(ss, SHEETS.GENRES, headersFor_(GENRE_COLUMNS));
  if (genres.getLastRow() < 2) {
    genres.getRange(2, 1, DEFAULT_GENRES.length, 1).setValues(DEFAULT_GENRES.map(function (g) { return [g]; }));
  }

  var settings = ensureSheet_(ss, SHEETS.SETTINGS, headersFor_(SETTINGS_COLUMNS));
  if (settings.getLastRow() < 2) {
    settings.getRange(2, 1, 2, 2).setValues([
      ['schemaVersion', SPINE_VERSION],
      ['bookIdCounter', '0'],
    ]);
  }

  ensureSheet_(ss, SHEETS.HISTORY, headersFor_(HISTORY_COLUMNS));

  // Initialise the ID counter from any existing rows so IDs never collide.
  var ids = readBookColumn_('id');
  var max = 0;
  ids.forEach(function (id) { max = Math.max(max, parseBookIdNumber_(id)); });
  var props = getScriptProps_();
  var current = Number(props.getProperty(PROP_KEYS.BOOK_ID_COUNTER) || 0);
  if (max > current) {
    props.setProperty(PROP_KEYS.BOOK_ID_COUNTER, String(max));
    mirrorSetting_('bookIdCounter', String(max));
  }

  Logger.log('Spine spreadsheet is ready.');
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var firstRow = sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
  var needsHeader = headers.some(function (h, i) { return String(firstRow[i] || '') !== h; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Convenience: print the current configuration status (never the values of
 * anything sensitive) so you can confirm setup from the editor.
 */
function checkConfiguration() {
  Logger.log('ACCESS_KEY set: ' + (getAccessKey_() ? 'yes' : 'no (the deployment URL alone grants access)'));
  Logger.log('Spreadsheet: ' + getSpreadsheet_().getName());
  [SHEETS.BOOKS, SHEETS.GENRES, SHEETS.SETTINGS, SHEETS.HISTORY].forEach(function (name) {
    Logger.log('Sheet "' + name + '": ' + (getSpreadsheet_().getSheetByName(name) ? 'ok' : 'MISSING'));
  });
}
