'use strict';
/**
 * 天保暦エンジン
 * 定気法による月・日の決定、閏月判定
 *
 * アルゴリズム概要:
 * 1. 各月の開始 = 朔(新月)の日 (JST 0時以降なら当日、前日深夜なら翌日)
 * 2. 中気を含まない月 → 閏月
 * 3. 月番号は中気の太陽黄経から決定 (中気 = 30°の倍数、奇数月に対応)
 */

const { solarLongitude, findSolarLongitude } = require('../astronomy/solar');
const { newMoonsFrom, previousNewMoon } = require('../astronomy/lunar');
const { jdToLocalGregorian, localGregorianToJD, jstMidnightJD } = require('../astronomy/datetime');

// 中気の黄経 (0°=春分点, 30°=穀雨... → 月番号)
// 中気の太陽黄経: month k の中気 = (k-1)*30 + 15? → 正確には:
// 中気: 0°(春分)=2月中, 30°(穀雨)=3月中, 60°=4月中...
// 天保暦の月番号と中気対応:
//   正月=雨水(330°), 2月=春分(0°), 3月=穀雨(30°), ...
// ただし実際には「中気を含む→その中気の月番号」
const CHUKI_LONGITUDE = [
  { long: 330, month: 1 },  // 雨水 → 正月
  { long: 0,   month: 2 },  // 春分 → 二月
  { long: 30,  month: 3 },  // 穀雨 → 三月
  { long: 60,  month: 4 },  // 小満 → 四月
  { long: 90,  month: 5 },  // 夏至 → 五月
  { long: 120, month: 6 },  // 大暑 → 六月
  { long: 150, month: 7 },  // 処暑 → 七月
  { long: 180, month: 8 },  // 秋分 → 八月
  { long: 210, month: 9 },  // 霜降 → 九月
  { long: 240, month: 10 }, // 小雪 → 十月
  { long: 270, month: 11 }, // 冬至 → 十一月
  { long: 300, month: 12 }, // 大寒 → 十二月
];

/**
 * JD (JST 正午) に対応する JST 日付の朔かどうか
 * 新月時刻が JST 0:00〜23:59 に含まれるか
 */
function isNewMoonDay(jdNoon, newMoonJD) {
  // JST での日付境界
  const dayStart = jdNoon - 0.5; // JST 0:00
  const dayEnd = jdNoon + 0.5;   // JST 24:00
  return newMoonJD >= dayStart && newMoonJD < dayEnd;
}

/**
 * 指定 JD (JST 0時) の太陽黄経 (度)
 */
function getSolarLongAtJSTMidnight(year, month, day) {
  return solarLongitude(jstMidnightJD(year, month, day) + 9 / 24);
}

/**
 * ある朔月 (新月 JD) から次の朔月の間に含まれる中気を返す
 * @param {number} nmStart - 今月の朔 JD
 * @param {number} nmEnd   - 次月の朔 JD
 * @returns {{ long: number, month: number, jd: number }[]}
 */
function getChukiInMonth(nmStart, nmEnd) {
  const result = [];
  // 月中の太陽黄経範囲
  const lonStart = solarLongitude(nmStart);
  const lonEnd = solarLongitude(nmEnd);

  for (const chuki of CHUKI_LONGITUDE) {
    let targetLong = chuki.long;
    // 折り返し処理: 朔月をまたぐ場合
    let approxJD = nmStart + 15; // 月中頃を初期値
    // 太陽は1日約1°進む
    let diff = targetLong - lonStart;
    if (diff < 0) diff += 360;
    if (diff > 360) diff -= 360;
    if (diff > 180) continue; // この月の範囲外

    approxJD = nmStart + diff;
    const jdChuki = findSolarLongitude(targetLong, approxJD);
    if (jdChuki >= nmStart && jdChuki < nmEnd) {
      result.push({ ...chuki, jd: jdChuki });
    }
  }
  return result;
}

/**
 * 天保暦の月リストを生成
 * @param {number} yearGreg - グレゴリオ暦年 (概算)
 * @param {number} monthCount - 生成する月数 (前後バッファ含む)
 * @returns {TenpoMonth[]}
 */
function buildTenpoMonths(yearGreg, monthCount = 15) {
  // 対象年の前年末から新月を列挙
  const startJD = localGregorianToJD(yearGreg - 1, 11, 1, 0, 0, 9);
  const newMoons = newMoonsFrom(startJD, monthCount + 2);

  const months = [];
  for (let i = 0; i < newMoons.length - 1; i++) {
    const nmStart = newMoons[i];
    const nmEnd = newMoons[i + 1];
    const chukiList = getChukiInMonth(nmStart, nmEnd);
    const hasChuki = chukiList.length > 0;
    const chuki = chukiList[0] || null;

    // 月の開始日 (JST)
    const startDate = jdToLocalGregorian(nmStart, 9);
    // 月の終了日 = 次の朔の前日
    const endDate = jdToLocalGregorian(nmEnd - 1, 9);

    months.push({
      newMoonJD: nmStart,
      nextNewMoonJD: nmEnd,
      startGreg: { year: startDate.year, month: startDate.month, day: startDate.day },
      endGreg: { year: endDate.year, month: endDate.month, day: endDate.day },
      hasChuki,
      chuki,
      tenpoMonth: chuki ? chuki.month : null, // 仮置き
      isLeap: !hasChuki,
      length: Math.round(nmEnd - nmStart), // 月の日数
    });
  }

  // 閏月前の月番号を引き継ぐ処理
  let lastMonth = null;
  for (const m of months) {
    if (m.isLeap) {
      m.tenpoMonth = lastMonth;
    } else {
      lastMonth = m.tenpoMonth;
    }
  }

  return months;
}

/**
 * グレゴリオ暦日 → 天保暦日
 * @param {number} year グレゴリオ暦年
 * @param {number} month
 * @param {number} day
 * @param {{ lat: number, lng: number }} location - 緯度経度 (将来拡張用)
 * @returns {{ tenpoYear, tenpoMonth, tenpoDay, isLeap, moonAge, chuki, kanshi }}
 */
function gregorianToTenpo(year, month, day, location = null) {
  const jdTarget = jstMidnightJD(year, month, day);

  // 対象日を含む月リストを生成
  const months = buildTenpoMonths(year);

  // 対象日が属する月を検索
  let targetMonth = null;
  for (const m of months) {
    const mStart = jstMidnightJD(m.startGreg.year, m.startGreg.month, m.startGreg.day);
    const mEnd = jstMidnightJD(m.endGreg.year, m.endGreg.month, m.endGreg.day) + 1;
    if (jdTarget >= mStart && jdTarget < mEnd) {
      targetMonth = m;
      break;
    }
  }

  if (!targetMonth) {
    // 年をまたぐ場合の再試行
    const months2 = buildTenpoMonths(year + 1);
    for (const m of months2) {
      const mStart = jstMidnightJD(m.startGreg.year, m.startGreg.month, m.startGreg.day);
      const mEnd = jstMidnightJD(m.endGreg.year, m.endGreg.month, m.endGreg.day) + 1;
      if (jdTarget >= mStart && jdTarget < mEnd) {
        targetMonth = m;
        break;
      }
    }
  }

  if (!targetMonth) return null;

  const mStart = jstMidnightJD(targetMonth.startGreg.year, targetMonth.startGreg.month, targetMonth.startGreg.day);
  const tenpoDay = Math.round(jdTarget - mStart) + 1;

  // 月齢 (JST 正午基準)
  const { moonAge } = require('../astronomy/lunar');
  const age = moonAge(jdTarget + 9 / 24);

  // 天保暦年: 冬至を含む月=十一月として年を決定 (旧暦正月=翌年)
  // 簡易実装: 正月(1月)の開始グレゴリオ年を天保暦年とする
  // 旧暦年は正月の属するグレゴリオ年 (1月か2月初旬)
  let tenpoYear = year;
  if (targetMonth.tenpoMonth === 1 && !targetMonth.isLeap) {
    tenpoYear = targetMonth.startGreg.year;
  }

  // 干支
  const kanshi = getKanshi(tenpoYear);

  return {
    tenpoYear,
    tenpoMonth: targetMonth.tenpoMonth,
    tenpoDay,
    isLeap: targetMonth.isLeap,
    monthLength: targetMonth.length,
    moonAge: age,
    chuki: targetMonth.chuki ? targetMonth.chuki.long : null,
    kanshi,
    startGreg: targetMonth.startGreg,
  };
}

/**
 * 天保暦年の月カレンダーを生成 (特定のグレゴリオ年の旧暦月一覧)
 * @param {number} gregYear
 * @returns {TenpoMonth[]}
 */
function getTenpoMonthsForYear(gregYear) {
  const months = buildTenpoMonths(gregYear);
  // グレゴリオ暦年に属するものを抽出 (概算)
  return months.filter(m =>
    m.startGreg.year === gregYear ||
    (m.startGreg.year === gregYear - 1 && m.startGreg.month >= 12) ||
    (m.startGreg.year === gregYear + 1 && m.startGreg.month <= 2)
  );
}

// 干支
const KAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const SHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function getKanshi(year) {
  const k = ((year - 4) % 10 + 10) % 10;
  const s = ((year - 4) % 12 + 12) % 12;
  return KAN[k] + SHI[s];
}

// 旧暦月名
const TENPO_MONTH_NAMES = ['睦月','如月','弥生','卯月','皐月','水無月','文月','葉月','長月','神無月','霜月','師走'];
function tenpoMonthName(n) {
  if (n >= 1 && n <= 12) return TENPO_MONTH_NAMES[n - 1];
  return `${n}月`;
}

// 旧暦日名
const TENPO_DAY_NAMES = [
  '朔','二日','三日','四日','五日','六日','七日','八日','九日','十日',
  '十一日','十二日','十三日','十四日','十五日','十六日','十七日','十八日','十九日','二十日',
  '廿一日','廿二日','廿三日','廿四日','廿五日','廿六日','廿七日','廿八日','廿九日','晦'
];
function tenpoDayName(n) {
  return TENPO_DAY_NAMES[Math.min(n - 1, 29)] || `${n}日`;
}

module.exports = {
  gregorianToTenpo,
  getTenpoMonthsForYear,
  buildTenpoMonths,
  tenpoMonthName,
  tenpoDayName,
  getKanshi,
};
