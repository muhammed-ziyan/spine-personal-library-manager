/**
 * Genres are user-editable in the Genres sheet; the frontend never hardcodes them.
 * Column A is the genre, column B an optional comma-separated list of subgenres.
 */
function getGenres_() {
  var sheet = getSheet_(SHEETS.GENRES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, GENRE_COLUMNS.length).getValues();
  var seen = {};
  var genres = [];
  for (var i = 0; i < values.length; i++) {
    var name = cleanString_(unescapeCellText_(String(values[i][0] || '')), false);
    if (!name || seen[name]) continue;
    seen[name] = true;
    genres.push({ name: name, subgenres: parseSubgenreCell_(values[i][1]) });
  }
  return genres;
}

/** "Epic Fantasy, Dark Fantasy" → ['Epic Fantasy', 'Dark Fantasy']. Blank → []. */
function parseSubgenreCell_(raw) {
  var text = cleanString_(unescapeCellText_(String(raw === null || raw === undefined ? '' : raw)), false);
  if (!text) return [];
  var parts = text.split(',');
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var name = cleanString_(parts[i], false);
    if (!name || seen[name]) continue;
    seen[name] = true;
    out.push(name);
  }
  return out;
}
