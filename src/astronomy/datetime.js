'use strict';
/**
 * ユリウス通日 ⇔ 暦日変換
 * グレゴリオ暦 / ユリウス暦 対応
 */

/**
 * グレゴリオ暦 → JD (正午基準)
 * @param {number} year  西暦年
 * @param {number} month 月 (1-12)
 * @param {number} day   日 (実数可、時刻含む)
 * @returns {number} JD
 */
function gregorianToJD(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/**
 * JD → グレゴリオ暦 (UTC)
 * @param {number} jd
 * @returns {{ year, month, day, hour, minute, second }}
 */
function jdToGregorian(jd) {
  const jd2 = jd + 0.5;
  const Z = Math.floor(jd2);
  const F = jd2 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayFrac);
  const timeFrac = dayFrac - day;
  const totalSec = Math.round(timeFrac * 86400);
  const hour = Math.floor(totalSec / 3600);
  const minute = Math.floor((totalSec % 3600) / 60);
  const second = totalSec % 60;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return { year, month, day, hour, minute, second };
}

/**
 * JD → 地方時グレゴリオ暦 (タイムゾーンオフセット時間指定)
 * @param {number} jd
 * @param {number} tzOffset - タイムゾーン時間 (e.g. 9 for JST)
 * @returns {{ year, month, day, hour, minute, second, jd }}
 */
function jdToLocalGregorian(jd, tzOffset = 9) {
  return jdToGregorian(jd + tzOffset / 24);
}

/**
 * 地方グレゴリオ暦 → JD
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {number} tzOffset
 */
function localGregorianToJD(year, month, day, hour = 0, minute = 0, tzOffset = 9) {
  const dayFrac = day + (hour - tzOffset) / 24 + minute / 1440;
  return gregorianToJD(year, month, dayFrac);
}

/**
 * 日本標準時 (JST=UTC+9) の0時の JD
 */
function jstMidnightJD(year, month, day) {
  return localGregorianToJD(year, month, day, 0, 0, 9);
}

/**
 * 週日名
 */
const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
function weekday(jd) {
  return WEEKDAYS_JA[((Math.floor(jd + 1.5)) % 7 + 7) % 7];
}

module.exports = { gregorianToJD, jdToGregorian, jdToLocalGregorian, localGregorianToJD, jstMidnightJD, weekday };
