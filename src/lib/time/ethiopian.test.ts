import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ethiopianToGregorian,
  formatEthiopianDateAm,
  gregorianToEthiopian,
  gregorianToJdn,
  jdnToGregorian,
} from "./ethiopian.ts";

const g2e = (y: number, m: number, d: number) => gregorianToEthiopian(y, m, d);

test("Ethiopian New Year (1 Meskerem)", () => {
  assert.deepEqual(g2e(2024, 9, 11), { year: 2017, month: 1, day: 1 });
  assert.deepEqual(g2e(2025, 9, 11), { year: 2018, month: 1, day: 1 });
  assert.deepEqual(g2e(2026, 9, 11), { year: 2019, month: 1, day: 1 });
  // 2019 E.C. is a leap year (6 Pagume days), so 2020 E.C. begins on 12 September 2027.
  assert.deepEqual(g2e(2027, 9, 12), { year: 2020, month: 1, day: 1 });
  assert.deepEqual(g2e(2023, 9, 12), { year: 2016, month: 1, day: 1 });
});

test("Pagume (13th month)", () => {
  assert.deepEqual(g2e(2027, 9, 11), { year: 2019, month: 13, day: 6 }); // leap year: 6 days
  assert.deepEqual(g2e(2026, 9, 10), { year: 2018, month: 13, day: 5 }); // normal: 5 days
  assert.deepEqual(g2e(2026, 9, 6), { year: 2018, month: 13, day: 1 });
});

test("known dates in 2019 E.C.", () => {
  assert.deepEqual(g2e(2026, 11, 9), { year: 2019, month: 2, day: 30 }); // ጥቅምት 30
  assert.deepEqual(g2e(2026, 11, 10), { year: 2019, month: 3, day: 1 }); // ኅዳር 1
  assert.deepEqual(g2e(2026, 11, 11), { year: 2019, month: 3, day: 2 });
  assert.deepEqual(g2e(2026, 10, 11), { year: 2019, month: 2, day: 1 }); // ጥቅምት 1
});

test("holidays", () => {
  assert.deepEqual(g2e(2023, 1, 7), { year: 2015, month: 4, day: 29 }); // Genna (Christmas): ታኅሣሥ 29
  // Timket (ጥር 11) is on 20 January in the year after an Ethiopian leap year (2015 E.C. was one).
  assert.deepEqual(g2e(2024, 1, 20), { year: 2016, month: 5, day: 11 });
  assert.deepEqual(g2e(2025, 1, 19), { year: 2017, month: 5, day: 11 });
  assert.deepEqual(g2e(2025, 9, 27), { year: 2018, month: 1, day: 17 }); // Meskel: መስከረም 17
  assert.deepEqual(g2e(2000, 1, 1), { year: 1992, month: 4, day: 22 });
});

test("round trip Gregorian → Ethiopian → Gregorian for 30 years", () => {
  const start = gregorianToJdn(2010, 1, 1);
  const end = gregorianToJdn(2040, 12, 31);
  for (let jdn = start; jdn <= end; jdn++) {
    const g = jdnToGregorian(jdn);
    const e = gregorianToEthiopian(g.year, g.month, g.day);
    assert.ok(e.month >= 1 && e.month <= 13 && e.day >= 1 && e.day <= 30);
    if (e.month === 13) assert.ok(e.day <= 6);
    assert.deepEqual(ethiopianToGregorian(e.year, e.month, e.day), g);
  }
});

test("Amharic date label", () => {
  assert.equal(formatEthiopianDateAm({ year: 2019, month: 2, day: 30 }), "ጥቅምት 30, 2019 ዓ.ም");
  assert.equal(formatEthiopianDateAm({ year: 2019, month: 13, day: 6 }), "ጳጉሜ 6, 2019 ዓ.ም");
});
