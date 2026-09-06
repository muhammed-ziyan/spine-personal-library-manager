/**
 * Authoritative library statistics, computed from the Books sheet in one read.
 */
function getStats_() {
  var books = readAllBooks_().map(function (e) { return e.book; });
  var byStatus = {};
  BOOK_STATUSES.forEach(function (s) { byStatus[s] = 0; });
  var byGenre = {};
  var byLanguage = {};
  var rated = 0;
  var ratingSum = 0;

  for (var i = 0; i < books.length; i++) {
    var b = books[i];
    if (byStatus.hasOwnProperty(b.status)) byStatus[b.status] += 1;
    if (b.genre) byGenre[b.genre] = (byGenre[b.genre] || 0) + 1;
    if (b.language) byLanguage[b.language] = (byLanguage[b.language] || 0) + 1;
    if (b.rating) {
      rated += 1;
      ratingSum += b.rating;
    }
  }

  return {
    total: books.length,
    byStatus: byStatus,
    byGenre: byGenre,
    byLanguage: byLanguage,
    rated: rated,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
  };
}
