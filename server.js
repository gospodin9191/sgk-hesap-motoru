const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/** Cinsiyet normalize (kadın/erkek dışındaki varyasyonları düzeltir) */
function normalizeGenderTR(g) {
  if (!g) return "";
  const x = String(g).trim().toLowerCase();

  // Türkçe karakter sadeleştir
  const simplified = x
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");

  // Kadın eş anlamları
  if (
    simplified === "kadin" ||
    simplified === "k" ||
    simplified === "female" ||
    simplified === "woman" ||
    simplified === "bayan"
  ) return "kadın";

  // Erkek eş anlamları
  if (
    simplified === "erkek" ||
    simplified === "e" ||
    simplified === "male" ||
    simplified === "man" ||
    simplified === "bay"
  ) return "erkek";

  return "";
}

/**
 * Tarih formatı: "GG.AA.YYYY" (ör: "24.05.1999")
 */
function parseDateTR(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);

  const d = new Date(Date.UTC(yy, mm - 1, dd));

  // Geçersiz tarih kontrolü (31.02 gibi)
  if (
    d.getUTCFullYear() !== yy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) return null;

  return d;
}

function formatDateTR(d) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}.${mm}.${yy}`;
}

function addYearsUTC(date, years) {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const day = date.getUTCDate();

  const out = new Date(Date.UTC(y, m, day));

  // 29 Şubat gibi kayma olursa ayın son gününe çek
  if (out.getUTCMonth() !== m) {
    return new Date(Date.UTC(y, m + 1, 0));
  }
  return out;
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function yearsDiffFloor(from, to) {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const anniv = new Date(
    Date.UTC(from.getUTCFullYear() + years, from.getUTCMonth(), from.getUTCDate())
  );
  if (anniv > to) years -= 1;
  return Math.max(0, years);
}

function inRange(date, row) {
  if (row.start) {
    if (row.startInclusive) {
      if (date < row.start) return false;
    } else {
      if (date <= row.start) return false;
    }
  }
  if (row.end) {
    if (row.endInclusive) {
      if (date > row.end) return false;
    } else {
      if (date >= row.end) return false;
    }
  }
  return true;
}

function pickRow(date, rows) {
  const matches = rows.filter((r) => inRange(date, r));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return null;

  // Çakışma varsa en dar aralığı seç (güvenlik)
  matches.sort((a, b) => {
    const aSpan =
      a.start && a.end ? a.end.getTime() - a.start.getTime() : Number.MAX_SAFE_INTEGER;
    const bSpan =
      b.start && b.end ? b.end.getTime() - b.start.getTime() : Number.MAX_SAFE_INTEGER;
    return aSpan - bSpan;
  });
  return matches[0];
}

// ---- KADIN (tam emeklilik ana çizelge) ----
const KADIN_ROWS = [
  { label: "08.09.1981 ve öncesi", start: null, end: parseDateTR("08.09.1981"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: null, primReq: 5000 },

  { label: "09.09.1981-23.05.1984", start: parseDateTR("09.09.1981"), end: parseDateTR("23.05.1984"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 40, primReq: 5000 },
  { label: "24.05.1984-23.05.1985", start: parseDateTR("24.05.1984"), end: parseDateTR("23.05.1985"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 41, primReq: 5000 },
  { label: "24.05.1985-23.05.1986", start: parseDateTR("24.05.1985"), end: parseDateTR("23.05.1986"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 42, primReq: 5075 },
  { label: "24.05.1986-23.05.1987", start: parseDateTR("24.05.1986"), end: parseDateTR("23.05.1987"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 43, primReq: 5150 },
  { label: "24.05.1987-23.05.1988", start: parseDateTR("24.05.1987"), end: parseDateTR("23.05.1988"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 44, primReq: 5225 },
  { label: "24.05.1988-23.05.1989", start: parseDateTR("24.05.1988"), end: parseDateTR("23.05.1989"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 45, primReq: 5300 },
  { label: "24.05.1989-23.05.1990", start: parseDateTR("24.05.1989"), end: parseDateTR("23.05.1990"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 46, primReq: 5375 },
  { label: "24.05.1990-23.05.1991", start: parseDateTR("24.05.1990"), end: parseDateTR("23.05.1991"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 47, primReq: 5450 },
  { label: "24.05.1991-23.05.1992", start: parseDateTR("24.05.1991"), end: parseDateTR("23.05.1992"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 48, primReq: 5525 },
  { label: "24.05.1992-23.05.1993", start: parseDateTR("24.05.1992"), end: parseDateTR("23.05.1993"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 49, primReq: 5600 },
  { label: "24.05.1993-23.05.1994", start: parseDateTR("24.05.1993"), end: parseDateTR("23.05.1994"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 50, primReq: 5675 },
  { label: "24.05.1994-23.05.1995", start: parseDateTR("24.05.1994"), end: parseDateTR("23.05.1995"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 51, primReq: 5750 },
  { label: "24.05.1995-23.05.1996", start: parseDateTR("24.05.1995"), end: parseDateTR("23.05.1996"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 52, primReq: 5825 },
  { label: "24.05.1996-23.05.1997", start: parseDateTR("24.05.1996"), end: parseDateTR("23.05.1997"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 53, primReq: 5900 },
  { label: "24.05.1997-23.05.1998", start: parseDateTR("24.05.1997"), end: parseDateTR("23.05.1998"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 54, primReq: 5975 },
  { label: "24.05.1998-23.05.1999", start: parseDateTR("24.05.1998"), end: parseDateTR("23.05.1999"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 55, primReq: 5975 },
  { label: "24.05.1999-07.09.1999", start: parseDateTR("24.05.1999"), end: parseDateTR("07.09.1999"), startInclusive: true, endInclusive: true, yearReq: 20, ageReq: 56, primReq: 5975 },

  { label: "08.09.1999-30.04.2008", start: parseDateTR("08.09.1999"), end: parseDateTR("30.04.2008"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 58, primReq: 7000 },

  { label: "01.05.2008-31.12.2035", start: parseDateTR("01.05.2008"), end: parseDateTR("31.12.2035"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 58, primReq: 7200 },
  { label: "01.01.2036-31.12.2037", start: parseDateTR("01.01.2036"), end: parseDateTR("31.12.2037"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 59, primReq: 7200 },
  { label: "01.01.2038-31.12.2039", start: parseDateTR("01.01.2038"), end: parseDateTR("31.12.2039"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 60, primReq: 7200 },
  { label: "01.01.2040-31.12.2041", start: parseDateTR("01.01.2040"), end: parseDateTR("31.12.2041"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 61, primReq: 7200 },
  { label: "01.01.2042-31.12.2043", start: parseDateTR("01.01.2042"), end: parseDateTR("31.12.2043"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 62, primReq: 7200 },
  { label: "01.01.2044-31.12.2045", start: parseDateTR("01.01.2044"), end: parseDateTR("31.12.2045"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 63, primReq: 7200 },
  { label: "01.01.2046-31.12.2047", start: parseDateTR("01.01.2046"), end: parseDateTR("31.12.2047"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 64, primReq: 7200 },
  { label: "01.01.2048 ve sonrası", start: parseDateTR("01.01.2048"), end: null, startInclusive: true, endInclusive: true, yearReq: null, ageReq: 65, primReq: 7200 },
];

// ---- ERKEK (tam emeklilik ana çizelge) ----
const ERKEK_ROWS = [
  { label: "08.09.1976 ve öncesi", start: null, end: parseDateTR("08.09.1976"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: null, primReq: 5000 },

  { label: "09.09.1976-23.05.1979", start: parseDateTR("09.09.1976"), end: parseDateTR("23.05.1979"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 44, primReq: 5000 },
  { label: "24.05.1979-23.11.1980", start: parseDateTR("24.05.1979"), end: parseDateTR("23.11.1980"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 45, primReq: 5000 },
  { label: "24.11.1980-23.05.1982", start: parseDateTR("24.11.1980"), end: parseDateTR("23.05.1982"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 46, primReq: 5075 },
  { label: "24.05.1982-23.11.1983", start: parseDateTR("24.05.1982"), end: parseDateTR("23.11.1983"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 47, primReq: 5150 },
  { label: "24.11.1983-23.05.1985", start: parseDateTR("24.11.1983"), end: parseDateTR("23.05.1985"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 48, primReq: 5225 },
  { label: "24.05.1985-23.11.1986", start: parseDateTR("24.05.1985"), end: parseDateTR("23.11.1986"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 49, primReq: 5300 },
  { label: "24.11.1986-23.05.1988", start: parseDateTR("24.11.1986"), end: parseDateTR("23.05.1988"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 50, primReq: 5375 },
  { label: "24.05.1988-23.11.1989", start: parseDateTR("24.05.1988"), end: parseDateTR("23.11.1989"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 51, primReq: 5450 },
  { label: "24.11.1989-23.05.1991", start: parseDateTR("24.11.1989"), end: parseDateTR("23.05.1991"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 52, primReq: 5525 },
  { label: "24.05.1991-23.11.1992", start: parseDateTR("24.05.1991"), end: parseDateTR("23.11.1992"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 53, primReq: 5600 },
  { label: "24.11.1992-23.05.1994", start: parseDateTR("24.11.1992"), end: parseDateTR("23.05.1994"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 54, primReq: 5675 },
  { label: "24.05.1994-23.11.1995", start: parseDateTR("24.05.1994"), end: parseDateTR("23.11.1995"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 55, primReq: 5750 },
  { label: "24.11.1995-23.05.1997", start: parseDateTR("24.11.1995"), end: parseDateTR("23.05.1997"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 56, primReq: 5825 },
  { label: "24.05.1997-23.11.1998", start: parseDateTR("24.05.1997"), end: parseDateTR("23.11.1998"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 57, primReq: 5900 },
  { label: "24.11.1998-07.09.1999", start: parseDateTR("24.11.1998"), end: parseDateTR("07.09.1999"), startInclusive: true, endInclusive: true, yearReq: 25, ageReq: 58, primReq: 5975 },

  { label: "08.09.1999-30.04.2008", start: parseDateTR("08.09.1999"), end: parseDateTR("30.04.2008"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 60, primReq: 7000 },

  { label: "01.05.2008-31.12.2035", start: parseDateTR("01.05.2008"), end: parseDateTR("31.12.2035"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 60, primReq: 7200 },
  { label: "01.01.2036-31.12.2037", start: parseDateTR("01.01.2036"), end: parseDateTR("31.12.2037"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 61, primReq: 7200 },
  { label: "01.01.2038-31.12.2039", start: parseDateTR("01.01.2038"), end: parseDateTR("31.12.2039"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 62, primReq: 7200 },
  { label: "01.01.2040-31.12.2041", start: parseDateTR("01.01.2040"), end: parseDateTR("31.12.2041"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 63, primReq: 7200 },
  { label: "01.01.2042-31.12.2043", start: parseDateTR("01.01.2042"), end: parseDateTR("31.12.2043"), startInclusive: true, endInclusive: true, yearReq: null, ageReq: 64, primReq: 7200 },
  { label: "01.01.2044 ve sonrası", start: parseDateTR("01.01.2044"), end: null, startInclusive: true, endInclusive: true, yearReq: null, ageReq: 65, primReq: 7200 },
];

function calculate({ gender, birth, start, prim }) {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const birthD = parseDateTR(birth);
  const startD = parseDateTR(start);

  if (!birthD) return { error: "Doğum tarihi geçersiz. Örnek: 12.03.1980" };
  if (!startD) return { error: "Sigorta başlangıç tarihi geçersiz. Örnek: 24.05.1999" };
  if (!Number.isFinite(prim) || prim < 0) return { error: "Prim gün sayısı geçersiz." };

  const g = normalizeGenderTR(gender);
  const rows = g === "kadın" ? KADIN_ROWS : g === "erkek" ? ERKEK_ROWS : null;
  if (!rows) return { error: "Cinsiyet anlaşılamadı. Lütfen 'kadın' ya da 'erkek' olarak söyleyin." };

  const row = pickRow(startD, rows);
  if (!row) return { error: "Sigorta başlangıç tarihi çizelgede bulunamadı." };

  // EYT: 07.09.1999 ve öncesi
  const eytCutoff = parseDateTR("07.09.1999");
  const isEYT = startD <= eytCutoff;

  const primReq = row.primReq ?? 0;
  const yearReq = row.yearReq;               // null olabilir
  const ageReq = isEYT ? null : row.ageReq;  // EYT'de yaş aranmaz

  const primMissing = Math.max(0, primReq - prim);

  const primDoneDate = primMissing > 0 ? addDaysUTC(todayUTC, primMissing) : todayUTC;
  const sigDoneDate = yearReq != null ? addYearsUTC(startD, yearReq) : todayUTC;
  const ageDoneDate = ageReq != null ? addYearsUTC(birthD, ageReq) : todayUTC;

  // Tahmini emeklilik tarihi = en geç tamamlanan tarih
  const est = [primDoneDate, sigDoneDate, ageDoneDate].reduce((max, d) => (d > max ? d : max));

  const currentAge = yearsDiffFloor(birthD, todayUTC);
  const ageRemaining = ageReq != null ? Math.max(0, ageReq - currentAge) : 0;

  const sigElapsed = yearsDiffFloor(startD, todayUTC);
  const sigRemaining = yearReq != null ? Math.max(0, yearReq - sigElapsed) : 0;

  const canRetireNow =
    primMissing === 0 &&
    (yearReq == null || sigRemaining === 0) &&
    (ageReq == null || ageRemaining === 0);

  return {
    gender_normalized: g,
    isEYT,
    table_row: row.label,
    required: { sigortalilik_yil: yearReq, yas: ageReq, prim_gun: primReq },
    missing: { prim_gun: primMissing, yas: ageRemaining, sigortalilik_yil: sigRemaining },
    dates: {
      bugun: formatDateTR(todayUTC),
      prim_tamam: formatDateTR(primDoneDate),
      sigortalilik_tamam: formatDateTR(sigDoneDate),
      yas_tamam: formatDateTR(ageDoneDate),
      tahmini_emeklilik: formatDateTR(est),
    },
    canRetireNow,
  };
}

app.post("/calculate", (req, res) => {
  const { gender, birth, start, prim } = req.body || {};
  const out = calculate({
    gender,
    birth,
    start,
    prim: Number(prim),
  });
  res.json(out);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SGK hesap motoru çalışıyor. Port:", PORT));