'use strict';
/**
 * 月相計算 (Meeus Ch.47, Ch.49)
 * 朔(新月)の正確な時刻、月齢を計算
 */

const { julianCentury } = require('./solar');

/**
 * 月の平均近点角 [degrees]
 */
function moonMeanAnomaly(T) {
  return 134.9634114 + T * (477198.8676313 + T * (0.008997 + T / 69699 - T * T / 14712000));
}

/**
 * 月の引数の緯度 [degrees]
 */
function moonArgumentLatitude(T) {
  return 93.2720993 + T * (483202.0175273 - T * (0.0034029 + T / 3526000 - T * T / 863310000));
}

/**
 * 朔望の近似 JD を求める (k=0が J2000.0 直後の新月)
 * Meeus Table 47.a
 * @param {number} k - 朔望番号 (整数=新月, +0.5=満月)
 * @returns {number} 近似 JD
 */
function approximateNewMoon(k) {
  const T = k / 1236.85;
  return (
    2451550.09766 +
    29.530588861 * k +
    T * T * 0.00015437 -
    T * T * T * 0.000000150 +
    T * T * T * T * 0.00000000073
  );
}

/**
 * 新月・満月の精密 JD (Meeus Ch.47 補正項)
 * @param {number} k - 整数=新月, x.5=満月
 * @returns {number} 精密 JD
 */
function preciseLunarPhase(k) {
  const T = k / 1236.85;
  let JDE = approximateNewMoon(k);

  // 太陽の平均近点角
  const M = (2.5534 + 29.10535670 * k - T * T * 0.0000014 - T * T * T * 0.00000011) * Math.PI / 180;
  // 月の平均近点角
  const Mprime = (201.5643 + 385.81693528 * k + T * T * 0.0107582 + T * T * T * 0.00001238 - T * T * T * T * 0.000000058) * Math.PI / 180;
  // 月の引数の緯度
  const F = (160.7108 + 390.67050284 * k - T * T * 0.0016118 - T * T * T * 0.00000227 + T * T * T * T * 0.000000011) * Math.PI / 180;
  // 昇交点経度
  const omega = (124.7746 - 1.56375588 * k + T * T * 0.0020672 + T * T * T * 0.00000215) * Math.PI / 180;
  const E = 1 - T * 0.002516 - T * T * 0.0000074;

  // 新月補正 (主要項)
  const isNewMoon = Math.round(k) === k;
  if (isNewMoon) {
    JDE +=
      -0.40720 * Math.sin(Mprime) +
       0.17241 * E * Math.sin(M) +
       0.01608 * Math.sin(2 * Mprime) +
       0.01039 * Math.sin(2 * F) +
       0.00739 * E * Math.sin(Mprime - M) -
       0.00514 * E * Math.sin(Mprime + M) +
       0.00208 * E * E * Math.sin(2 * M) -
       0.00111 * Math.sin(Mprime - 2 * F) -
       0.00057 * Math.sin(Mprime + 2 * F) +
       0.00056 * E * Math.sin(2 * Mprime + M) -
       0.00042 * Math.sin(3 * Mprime) +
       0.00042 * E * Math.sin(M + 2 * F) +
       0.00038 * E * Math.sin(M - 2 * F) -
       0.00024 * E * Math.sin(2 * Mprime - M) -
       0.00017 * Math.sin(omega) -
       0.00007 * Math.sin(Mprime + 2 * M);
  } else {
    // 満月補正
    JDE +=
      -0.40614 * Math.sin(Mprime) +
       0.17302 * E * Math.sin(M) +
       0.01614 * Math.sin(2 * Mprime) +
       0.01043 * Math.sin(2 * F) +
       0.00734 * E * Math.sin(Mprime - M) -
       0.00515 * E * Math.sin(Mprime + M) +
       0.00209 * E * E * Math.sin(2 * M) -
       0.00111 * Math.sin(Mprime - 2 * F) -
       0.00057 * Math.sin(Mprime + 2 * F) +
       0.00056 * E * Math.sin(2 * Mprime + M) -
       0.00042 * Math.sin(3 * Mprime) +
       0.00042 * E * Math.sin(M + 2 * F) +
       0.00038 * E * Math.sin(M - 2 * F) -
       0.00024 * E * Math.sin(2 * Mprime - M) -
       0.00017 * Math.sin(omega) -
       0.00007 * Math.sin(Mprime + 2 * M);
  }

  // 付加補正項
  JDE +=
    0.000325 * Math.sin((299.77 + 0.107408 * k - 0.009173 * T * T) * Math.PI / 180) +
    0.000165 * Math.sin((251.88 + 0.016321 * k) * Math.PI / 180) +
    0.000164 * Math.sin((251.83 + 26.651886 * k) * Math.PI / 180) +
    0.000126 * Math.sin((349.42 + 36.412478 * k) * Math.PI / 180) +
    0.000110 * Math.sin((84.66 + 18.206239 * k) * Math.PI / 180) +
    0.000062 * Math.sin((141.74 + 53.303771 * k) * Math.PI / 180) +
    0.000060 * Math.sin((207.14 + 2.453732 * k) * Math.PI / 180) +
    0.000056 * Math.sin((154.84 + 7.306860 * k) * Math.PI / 180) +
    0.000047 * Math.sin((34.52 + 27.261239 * k) * Math.PI / 180) +
    0.000042 * Math.sin((207.19 + 0.121824 * k) * Math.PI / 180) +
    0.000040 * Math.sin((291.34 + 1.844379 * k) * Math.PI / 180) +
    0.000037 * Math.sin((161.72 + 24.198154 * k) * Math.PI / 180) +
    0.000035 * Math.sin((239.56 + 25.513099 * k) * Math.PI / 180) +
    0.000023 * Math.sin((331.55 + 3.592518 * k) * Math.PI / 180);

  return JDE;
}

/**
 * 指定 JD の直前の新月 JD を返す
 * @param {number} jd
 * @returns {number} 新月 JD (TT, ≒ JST-9h)
 */
function previousNewMoon(jd) {
  // k の近似値 (J2000.0 からの朔望月数)
  const k = Math.floor((jd - 2451550.09766) / 29.530588861);
  let jdNM = preciseLunarPhase(k);
  // jd より後になってしまう場合は1つ前へ
  if (jdNM > jd) jdNM = preciseLunarPhase(k - 1);
  return jdNM;
}

/**
 * 月齢 (新月からの経過日数)
 * @param {number} jd - 対象 JD
 * @returns {number} 月齢 [日]
 */
function moonAge(jd) {
  const nm = previousNewMoon(jd);
  return jd - nm;
}

/**
 * 指定 JD 以降の新月列を n 個返す
 * @param {number} jdStart
 * @param {number} n
 * @returns {number[]} 新月 JD 配列
 */
function newMoonsFrom(jdStart, n) {
  const k0 = Math.floor((jdStart - 2451550.09766) / 29.530588861);
  const result = [];
  let k = k0 - 1;
  while (result.length < n) {
    const jd = preciseLunarPhase(k);
    if (jd >= jdStart) result.push(jd);
    k++;
  }
  return result;
}

module.exports = { previousNewMoon, moonAge, newMoonsFrom, preciseLunarPhase };
