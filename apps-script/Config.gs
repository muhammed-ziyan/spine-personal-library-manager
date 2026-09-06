/**
 * Spine backend configuration.
 *
 * Nothing in this file is secret. Deployment-specific values live in Script
 * Properties — see README → "Google Apps Script setup".
 */

var SPINE_VERSION = '1.0.0';

/** Script Property keys. */
var PROP_KEYS = {
  /**
   * Optional shared secret. When set, every request must carry the same value
   * in its `key` field; when empty the deployment URL alone grants access.
   */
  ACCESS_KEY: 'ACCESS_KEY',
  /** Optional: spreadsheet ID when the script is not container-bound. */
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  /** Monotonic counter for Book IDs. Never edit by hand. */
  BOOK_ID_COUNTER: 'BOOK_ID_COUNTER',
};

/** Hard limits applied to every mutation (mirrors src/utils/validation.ts). */
var LIMITS = {
  title: 300,
  author: 300,
  publisher: 300,
  genre: 100,
  language: 100,
  edition: 100,
  format: 50,
  notes: 5000,
  coverUrl: 1000,
  isbnMin: 10,
  isbnMax: 13,
  pagesMax: 50000,
  yearMin: 1000,
  requestBytes: 64 * 1024,
  accessKeyMax: 256,
  /** Requests per minute for the whole deployment. Generous for one person, tight for abuse. */
  rateLimitPerMinute: 120,
  /** Maximum page size for getBooks. */
  pageMax: 500,
};

var BOOK_STATUSES = ['Unread', 'Reading', 'Read', 'On Hold', 'Abandoned'];

var DEFAULT_GENRES = [
  'Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Horror', 'Romance',
  'Historical Fiction', 'Literary Fiction', 'Biography', 'Autobiography', 'History',
  'Philosophy', 'Psychology', 'Self Help', 'Science', 'Technology', 'Business',
  'Politics', 'Religion', 'Travel', 'Poetry', 'Essays', 'Children', 'Comics', 'Other',
];

function getScriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getConfigValue_(key) {
  var value = getScriptProps_().getProperty(key);
  return value ? String(value).trim() : '';
}

function getAccessKey_() {
  return getConfigValue_(PROP_KEYS.ACCESS_KEY);
}

/**
 * The one spreadsheet this backend is allowed to touch. The client can never
 * influence this: it is either the bound spreadsheet or a Script Property.
 */
function getSpreadsheet_() {
  var id = getConfigValue_(PROP_KEYS.SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No spreadsheet configured. Bind the script to a sheet or set SPREADSHEET_ID.');
  return active;
}
