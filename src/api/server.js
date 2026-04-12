'use strict';
const express = require('express');
const path = require('path');
const { gregorianToTenpo, getTenpoMonthsForYear, buildTenpoMonths, tenpoMonthName, tenpoDayName, getKanshi } = require('../calendar/tenpo');
const { moonAge } = require('../astronomy/lunar');
const { jstMidnightJD, jdToLocalGregorian } = require('../astronomy/datetime');
const { solarLongitude } = require('../astronomy/solar');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

/**
 * GET /api/date?year=&month=&day=
 * 指定グレゴリオ暦日の天保暦情報
 */
app.get('/api/date', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const day = parseInt(req.query.day) || new Date().getDate();

  try {
    const tenpo = gregorianToTenpo(year, month, day);
    if (!tenpo) return res.status(404).json({ error: '天保暦変換失敗' });

    const jd = jstMidnightJD(year, month, day) + 9 / 24 + 0.5; // 正午
    const age = moonAge(jd);
    const sunLon = solarLongitude(jd);

    res.json({
      gregorian: { year, month, day },
      tenpo: {
        year: tenpo.tenpoYear,
        month: tenpo.tenpoMonth,
        monthName: tenpoMonthName(tenpo.tenpoMonth),
        day: tenpo.tenpoDay,
        dayName: tenpoDayName(tenpo.tenpoDay),
        isLeap: tenpo.isLeap,
        monthLength: tenpo.monthLength,
        kanshi: tenpo.kanshi,
      },
      astronomy: {
        moonAge: Math.round(age * 10) / 10,
        moonPhase: getMoonPhaseName(age),
        moonEmoji: getMoonEmoji(age),
        solarLongitude: Math.round(sunLon * 100) / 100,
        sekki: getSekki(sunLon),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/month?year=&month=
 * グレゴリオ暦月のカレンダーデータ
 */
app.get('/api/month', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const tenpo = gregorianToTenpo(year, month, d);
      const jd = jstMidnightJD(year, month, d) + 9 / 24 + 0.5;
      const age = moonAge(jd);
      const sunLon = solarLongitude(jd);

      days.push({
        day: d,
        tenpo: tenpo ? {
          month: tenpo.tenpoMonth,
          monthName: tenpoMonthName(tenpo.tenpoMonth),
          day: tenpo.tenpoDay,
          dayName: tenpoDayName(tenpo.tenpoDay),
          isLeap: tenpo.isLeap,
          isNewMonth: tenpo.tenpoDay === 1,
        } : null,
        moonAge: Math.round(age * 10) / 10,
        moonEmoji: getMoonEmoji(age),
        sekki: getSekki(sunLon),
      });
    }

    res.json({ year, month, days });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lunarmonth?year=&month=&isLeap=
 * 旧暦月の全日データ（朔日〜晦日）
 */
app.get('/api/lunarmonth', (req, res) => {
  const gregYear = parseInt(req.query.year) || new Date().getFullYear();
  const tenpoMonth = parseInt(req.query.month);
  const isLeap = req.query.isLeap === 'true';
  if (!tenpoMonth) return res.status(400).json({ error: 'month は必須です' });

  try {
    let targetM = null;
    for (const yr of [gregYear, gregYear - 1, gregYear + 1]) {
      const list = buildTenpoMonths(yr, 18);
      targetM = list.find(m => m.tenpoMonth === tenpoMonth && m.isLeap === isLeap);
      if (targetM) break;
    }
    if (!targetM) return res.status(404).json({ error: '旧暦月が見つかりません' });

    const days = [];
    for (let i = 0; i < targetM.length; i++) {
      const g = jdToLocalGregorian(targetM.newMoonJD + i, 9);
      const jdNoon = targetM.newMoonJD + i + 9 / 24 + 0.5;
      const age = moonAge(jdNoon);
      const sunLon = solarLongitude(jdNoon);
      days.push({
        tenpoDay: i + 1,
        dayName: tenpoDayName(i + 1),
        greg: { year: g.year, month: g.month, day: g.day },
        moonAge: Math.round(age * 10) / 10,
        moonEmoji: getMoonEmoji(age),
        sekki: getSekki(sunLon),
      });
    }

    res.json({
      tenpoMonth,
      tenpoMonthName: tenpoMonthName(tenpoMonth),
      isLeap,
      length: targetM.length,
      startGreg: targetM.startGreg,
      endGreg: targetM.endGreg,
      days,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/newmoons?year=
 * 指定グレゴリオ暦年前後の朔日一覧
 */
app.get('/api/newmoons', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const months = buildTenpoMonths(year, 16);
    const result = months.map(m => ({
      newMoonJD: Math.round(m.newMoonJD * 10000) / 10000,
      startGreg: m.startGreg,
      endGreg: m.endGreg,
      tenpoMonth: m.tenpoMonth,
      tenpoMonthName: tenpoMonthName(m.tenpoMonth),
      isLeap: m.isLeap,
      length: m.length,
      chuki: m.chuki ? {
        longitude: m.chuki.long,
        name: getChukiName(m.chuki.long),
      } : null,
    }));
    res.json({ year, months: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ユーティリティ
function getMoonEmoji(age) {
  const phase = age / 29.53;
  if (phase < 0.033 || phase > 0.967) return '🌑';
  if (phase < 0.133) return '🌒';
  if (phase < 0.233) return '🌓';
  if (phase < 0.367) return '🌔';
  if (phase < 0.533) return '🌕';
  if (phase < 0.633) return '🌖';
  if (phase < 0.733) return '🌗';
  if (phase < 0.867) return '🌘';
  return '🌑';
}

function getMoonPhaseName(age) {
  const phase = age / 29.53;
  if (phase < 0.033 || phase > 0.967) return '新月(朔)';
  if (phase < 0.133) return '三日月';
  if (phase < 0.233) return '上弦の月';
  if (phase < 0.367) return '十日夜';
  if (phase < 0.533) return '満月(望)';
  if (phase < 0.633) return '十六夜';
  if (phase < 0.733) return '下弦の月';
  if (phase < 0.867) return '二十六夜';
  return '晦日の月';
}

const SEKKI_LIST = [
  { long: 315, name: '小寒' },
  { long: 330, name: '大寒' },
  { long: 345, name: '立春' },
  { long: 0,   name: '雨水' },
  { long: 15,  name: '啓蟄' },
  { long: 30,  name: '春分' },
  { long: 45,  name: '清明' },
  { long: 60,  name: '穀雨' },
  { long: 75,  name: '立夏' },
  { long: 90,  name: '小満' },
  { long: 105, name: '芒種' },
  { long: 120, name: '夏至' },
  { long: 135, name: '小暑' },
  { long: 150, name: '大暑' },
  { long: 165, name: '立秋' },
  { long: 180, name: '処暑' },
  { long: 195, name: '白露' },
  { long: 210, name: '秋分' },
  { long: 225, name: '寒露' },
  { long: 240, name: '霜降' },
  { long: 255, name: '立冬' },
  { long: 270, name: '小雪' },
  { long: 285, name: '大雪' },
  { long: 300, name: '冬至' },
];

function getSekki(lon) {
  for (const s of SEKKI_LIST) {
    if (Math.abs(lon - s.long) < 0.5 || (s.long === 0 && (lon < 0.5 || lon > 359.5))) {
      return s.name;
    }
  }
  return null;
}

function getChukiName(lon) {
  const CHUKI_NAMES = {
    330: '雨水', 0: '春分', 30: '穀雨', 60: '小満',
    90: '夏至', 120: '大暑', 150: '処暑', 180: '秋分',
    210: '霜降', 240: '小雪', 270: '冬至', 300: '大寒',
  };
  return CHUKI_NAMES[lon] || `${lon}°`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌕 天保暦サーバー起動: http://localhost:${PORT}`);
});

module.exports = app;
