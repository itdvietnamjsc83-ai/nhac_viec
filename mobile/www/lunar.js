// Đổi dương lịch -> âm lịch Việt Nam (thuật toán của Hồ Ngọc Đức, múi giờ +7)
(function (root) {
  const INT = Math.floor, PI = Math.PI;
  function jdFromDate(dd, mm, yy) {
    const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
    let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
    if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
    return jd;
  }
  function newMoon(k, tz) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    const deltat = T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
    return INT(Jd1 + C1 - deltat + 0.5 + tz / 24);
  }
  function sunLongitude(jdn, tz) {
    const T = (jdn - 2451545.5 - tz / 24) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = (L0 + DL) * dr;
    L = L - PI * 2 * INT(L / (PI * 2));
    return INT(L / PI * 6);
  }
  function lunarMonth11(yy, tz) {
    const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
    let nm = newMoon(k, tz);
    if (sunLongitude(nm, tz) >= 9) nm = newMoon(k - 1, tz);
    return nm;
  }
  function leapMonthOffset(a11, tz) {
    const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last, i = 1, arc = sunLongitude(newMoon(k + i, tz), tz);
    do { last = arc; i++; arc = sunLongitude(newMoon(k + i, tz), tz); } while (arc !== last && i < 14);
    return i - 1;
  }
  function solarToLunar(dd, mm, yy, tz = 7) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = newMoon(k + 1, tz);
    if (monthStart > dayNumber) monthStart = newMoon(k, tz);
    let a11 = lunarMonth11(yy, tz), b11 = a11, year;
    if (a11 >= monthStart) { year = yy; a11 = lunarMonth11(yy - 1, tz); }
    else { year = yy + 1; b11 = lunarMonth11(yy + 1, tz); }
    const day = dayNumber - monthStart + 1;
    const diff = INT((monthStart - a11) / 29);
    let leap = false, month = diff + 11;
    if (b11 - a11 > 365) {
      const lm = leapMonthOffset(a11, tz);
      if (diff >= lm) { month = diff + 10; if (diff === lm) leap = true; }
    }
    if (month > 12) month -= 12;
    if (month >= 11 && diff < 4) year -= 1;
    return { day, month, year, leap };
  }
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const yearName = y => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;

  const SOLAR_HOLIDAYS = { '1/1': 'Tết Dương lịch', '14/2': 'Valentine', '8/3': 'Quốc tế Phụ nữ', '30/4': 'Giải phóng miền Nam', '1/5': 'Quốc tế Lao động', '1/6': 'Quốc tế Thiếu nhi', '2/9': 'Quốc khánh', '20/10': 'Phụ nữ Việt Nam', '20/11': 'Nhà giáo Việt Nam', '24/12': 'Giáng sinh' };
  const LUNAR_HOLIDAYS = { '1/1': 'Tết Nguyên đán', '2/1': 'Tết', '3/1': 'Tết', '15/1': 'Rằm tháng Giêng', '10/3': 'Giỗ Tổ Hùng Vương', '15/4': 'Phật đản', '5/5': 'Tết Đoan ngọ', '15/7': 'Vu Lan', '15/8': 'Trung thu', '23/12': 'Ông Công ông Táo' };
  function holiday(d) {
    const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    return (!l.leap && LUNAR_HOLIDAYS[`${l.day}/${l.month}`]) || SOLAR_HOLIDAYS[`${d.getDate()}/${d.getMonth() + 1}`] || '';
  }

  const api = { solarToLunar, yearName, holiday };
  if (typeof module !== 'undefined') module.exports = api; else root.Lunar = api;
})(this);
