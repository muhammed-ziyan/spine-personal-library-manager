/**
 * Genres are user-editable in the Genres sheet; the frontend never hardcodes them.
 */
function getGenres_() {
  var sheet = getSheet_(SHEETS.GENRES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var seen = {};
  var genres = [];
  for (var i = 0; i < values.length; i++) {
    var name = cleanString_(unescapeCellText_(String(values[i][0] || '')), false);
    if (!name || seen[name]) continue;
    seen[name] = true;
    genres.push({ name: name });
  }
  return genres;
}
