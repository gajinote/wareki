'use strict';
/**
 * 天保暦エンジン検証スクリプト
 * 既知の旧暦日付との照合
 */
const { gregorianToTenpo, tenpoMonthName, tenpoDayName } = require('../src/calendar/tenpo');
const { moonAge } = require('../src/astronomy/lunar');
const { solarLongitude } = require('../src/astronomy/solar');
const { jstMidnightJD } = require('../src/astronomy/datetime');

// 検証データ (出典: 国立天文台 暦計算室)
const TEST_CASES = [
  { greg: [2024, 1,  1],  expected: { month: 11, day: 20 }, note: '2024元旦=旧暦十一月二十日' },
  { greg: [2024, 2, 10],  expected: { month: 1,  day: 1  }, note: '2024旧暦元旦=春節' },
  { greg: [2024, 3, 10],  expected: { month: 2,  day: 1  }, note: '2024旧暦二月朔日 (朔: 3/10 18:01 JST)' },
  { greg: [2024, 9, 17],  expected: { month: 8,  day: 15 }, note: '2024中秋の名月' },
  { greg: [2023, 1, 22],  expected: { month: 1,  day: 1  }, note: '2023旧暦元旦' },
  { greg: [2023, 6, 19],  expected: { month: 5,  day: 2  }, note: '2023閏5月前' },
];

console.log('=== 天保暦エンジン検証 ===\n');

let pass = 0, fail = 0;
for (const tc of TEST_CASES) {
  const [y, m, d] = tc.greg;
  const res = gregorianToTenpo(y, m, d);
  if (!res) {
    console.log(`❌ ${y}/${m}/${d}: 変換失敗 (${tc.note})`);
    fail++; continue;
  }

  const ok = res.tenpoMonth === tc.expected.month && res.tenpoDay === tc.expected.day;
  const status = ok ? '✅' : '❌';
  const leap = res.isLeap ? '閏' : '';
  console.log(`${status} ${y}/${m}/${d} → 旧暦 ${leap}${res.tenpoMonth}月${res.tenpoDay}日`
    + ` (期待: ${tc.expected.month}月${tc.expected.day}日)`
    + ` [月齢: ${res.moonAge.toFixed(1)}日]`
    + ` — ${tc.note}`);
  if (ok) pass++; else fail++;
}

console.log(`\n結果: ${pass}/${TEST_CASES.length} 合格`);

// 節気チェック
console.log('\n=== 2024年 二十四節気 (太陽黄経) ===');
const SEKKI = [
  [2024,  1,  6, 285, '小寒'],
  [2024,  1, 20, 300, '大寒'],
  [2024,  2,  4, 315, '立春'],
  [2024,  3, 20,   0, '春分'],
  [2024,  6, 21,  90, '夏至'],
  [2024,  9, 22, 180, '秋分'],
  [2024, 12, 21, 270, '冬至'],
];
for (const [y, m, d, expLon, name] of SEKKI) {
  const jd = jstMidnightJD(y, m, d) + 0.5;
  const lon = solarLongitude(jd);
  const diff = Math.abs(lon - expLon);
  const adjDiff = Math.min(diff, 360 - diff);
  const ok = adjDiff < 1.0;
  console.log(`${ok ? '✅' : '❌'} ${name} ${y}/${m}/${d}: 黄経 ${lon.toFixed(2)}° (期待: ${expLon}°, 差: ${adjDiff.toFixed(2)}°)`);
}

// 月齢チェック
console.log('\n=== 2024年 中秋の名月 月齢検証 ===');
const jd = jstMidnightJD(2024, 9, 17) + 0.5;
const age = moonAge(jd);
console.log(`2024/9/17 (中秋の名月) 月齢: ${age.toFixed(2)}日 (期待: 約14-15日)`);
