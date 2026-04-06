'use strict';
/**
 * 太陽黄経計算 (Meeus "Astronomical Algorithms" Ch.25/27)
 * 精度: ±0.01° (時刻誤差 ±数分)
 */

/**
 * ユリウス通日 (JD) → ユリウス世紀数 T (J2000.0基準)
 */
function julianCentury(jd) {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * 太陽の幾何学的平均黄経 [degrees]
 */
function sunMeanLongitude(T) {
  return (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
}

/**
 * 太陽の平均近点角 [degrees]
 */
function sunMeanAnomaly(T) {
  return 357.52911 + T * (35999.05029 - T * 0.0001537);
}

/**
 * 地球軌道の離心率
 */
function earthEccentricity(T) {
  return 0.016708634 - T * (0.000042037 + T * 0.0000001267);
}

/**
 * 太陽の中心差 [degrees]
 */
function sunEquationOfCenter(T) {
  const M = sunMeanAnomaly(T) * Math.PI / 180;
  const e = earthEccentricity(T);
  return (
    Math.sin(M) * (1.9146 - T * (0.004817 + T * 0.000014)) +
    Math.sin(2 * M) * (0.019993 - T * 0.000101) +
    Math.sin(3 * M) * 0.00029
  );
}

/**
 * 黄道傾斜角 [degrees]
 */
function obliquityOfEcliptic(T) {
  return 23.439291111 - T * (0.013004167 + T * (0.000000164 - T * 0.000000504));
}

/**
 * 章動補正 (簡略版) [degrees]
 */
function nutation(T) {
  const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
  return -0.00569 - 0.00478 * Math.sin(omega);
}

/**
 * 太陽の視黄経 [degrees, 0-360]
 * @param {number} jd - ユリウス通日
 * @returns {number} 太陽視黄経 [degrees]
 */
function solarLongitude(jd) {
  const T = julianCentury(jd);
  const L0 = sunMeanLongitude(T);
  const C = sunEquationOfCenter(T);
  const sunTrueLong = L0 + C;
  // 黄道昇交点
  const omega = 125.04 - 1934.136 * T;
  // 視黄経
  const apparent = sunTrueLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
  return ((apparent % 360) + 360) % 360;
}

/**
 * 指定 JD における太陽の視赤緯・視赤経 (均時差計算用)
 */
function solarPosition(jd) {
  const T = julianCentury(jd);
  const lambda = solarLongitude(jd) * Math.PI / 180;
  const epsilon = (obliquityOfEcliptic(T) + nutation(T)) * Math.PI / 180;
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  return { ra: ra * 180 / Math.PI, dec: dec * 180 / Math.PI };
}

/**
 * 指定した太陽黄経(度)になる直前の朔望 JD を二分法で求める
 * @param {number} targetLong - 目標黄経 [degrees]
 * @param {number} jdApprox - 近似 JD
 * @returns {number} JD
 */
function findSolarLongitude(targetLong, jdApprox) {
  let jd = jdApprox;
  for (let i = 0; i < 50; i++) {
    const lon = solarLongitude(jd);
    let diff = targetLong - lon;
    // 360度折り返し
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const step = diff / 360 * 365.25; // 太陽は365.25日で360°
    if (Math.abs(step) < 0.0001) break;
    jd += step;
  }
  return jd;
}

module.exports = { solarLongitude, solarPosition, findSolarLongitude, julianCentury, obliquityOfEcliptic };
