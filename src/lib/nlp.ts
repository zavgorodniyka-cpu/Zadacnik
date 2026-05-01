import { toISODate } from "./dates";

export type ParsedTask = {
  title: string;
  dueDate?: string;
  dueTime?: string;
  endTime?: string;
};

const MONTH_NAMES: Record<string, number> = {
  "января": 0, "январь": 0, "янв": 0,
  "февраля": 1, "февраль": 1, "фев": 1,
  "марта": 2, "март": 2, "мар": 2,
  "апреля": 3, "апрель": 3, "апр": 3,
  "мая": 4, "май": 4,
  "июня": 5, "июнь": 5, "июн": 5,
  "июля": 6, "июль": 6, "июл": 6,
  "августа": 7, "август": 7, "авг": 7,
  "сентября": 8, "сентябрь": 8, "сен": 8,
  "октября": 9, "октябрь": 9, "окт": 9,
  "ноября": 10, "ноябрь": 10, "ноя": 10,
  "декабря": 11, "декабрь": 11, "дек": 11,
};

const WEEKDAY_NAMES: Record<string, number> = {
  "понедельник": 1, "пн": 1,
  "вторник": 2, "вт": 2,
  "среду": 3, "среда": 3, "ср": 3,
  "четверг": 4, "чт": 4,
  "пятницу": 5, "пятница": 5, "пт": 5,
  "субботу": 6, "суббота": 6, "сб": 6,
  "воскресенье": 0, "вс": 0,
};

export function parseTask(input: string): ParsedTask {
  let text = ` ${input.trim().replace(/\s+/g, " ")} `;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let endTime: string | undefined;

  // 1. сегодня / завтра / послезавтра
  const dayWords: Array<[RegExp, number]> = [
    [/\sпослезавтра\s/i, 2],
    [/\sсегодня\s/i, 0],
    [/\sзавтра\s/i, 1],
  ];
  for (const [re, offset] of dayWords) {
    if (re.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      dueDate = toISODate(d);
      text = text.replace(re, " ");
      break;
    }
  }

  // 2. Weekday: "в понедельник", "во вторник", "в чт"
  if (!dueDate) {
    const keys = Object.keys(WEEKDAY_NAMES).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const re = new RegExp(`\\s(?:в(?:о)?\\s+)?${key}\\s`, "i");
      if (re.test(text)) {
        dueDate = toISODate(nextWeekday(new Date(), WEEKDAY_NAMES[key]));
        text = text.replace(re, " ");
        break;
      }
    }
  }

  // 3. "DD месяц [YYYY]"
  if (!dueDate) {
    const monthKeys = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length);
    const monthRe = new RegExp(
      `\\s(\\d{1,2})\\s+(${monthKeys.join("|")})(?:\\s+(\\d{4}))?\\s`,
      "i",
    );
    const m = text.match(monthRe);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = MONTH_NAMES[m[2].toLowerCase()];
      const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
      dueDate = toISODate(new Date(year, month, day));
      text = text.replace(monthRe, " ");
    }
  }

  // 4. DD.MM(.YYYY) or DD/MM
  if (!dueDate) {
    const dotRe = /\s(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\s/;
    const m = text.match(dotRe);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        dueDate = toISODate(new Date(year, month, day));
        text = text.replace(dotRe, " ");
      }
    }
  }

  // 5. Time range: "с HH(:MM) до HH(:MM)"
  const wordRangeRe = /\sс\s+(\d{1,2})(?::(\d{2}))?\s+до\s+(\d{1,2})(?::(\d{2}))?\s/i;
  const wordRange = text.match(wordRangeRe);
  if (wordRange) {
    const h1 = parseInt(wordRange[1], 10);
    const h2 = parseInt(wordRange[3], 10);
    if (h1 < 24 && h2 < 24) {
      dueTime = pad(h1) + ":" + (wordRange[2] || "00");
      endTime = pad(h2) + ":" + (wordRange[4] || "00");
      text = text.replace(wordRangeRe, " ");
    }
  } else {
    const dashRe = /\s(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s/;
    const m = text.match(dashRe);
    if (m) {
      const h1 = parseInt(m[1], 10);
      const h2 = parseInt(m[3], 10);
      if (h1 < 24 && h2 < 24) {
        dueTime = pad(h1) + ":" + (m[2] || "00");
        endTime = pad(h2) + ":" + (m[4] || "00");
        text = text.replace(dashRe, " ");
      }
    }
  }

  // 6. Single time
  if (!dueTime) {
    const colon = /\s(?:в\s+)?(\d{1,2}):(\d{2})\s/;
    const m = text.match(colon);
    if (m) {
      const h = parseInt(m[1], 10);
      if (h < 24) {
        dueTime = pad(h) + ":" + m[2];
        text = text.replace(colon, " ");
      }
    } else {
      const inHour = /\sв\s+(\d{1,2})(?:\s*ч(?:асов|аса|ас|\.)?)?\s/i;
      const m2 = text.match(inHour);
      if (m2) {
        const h = parseInt(m2[1], 10);
        if (h >= 0 && h <= 23) {
          dueTime = pad(h) + ":00";
          text = text.replace(inHour, " ");
        }
      }
    }
  }

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^(в|во|на)\s+/i, "").trim();
  if (text) text = text[0].toUpperCase() + text.slice(1);

  return { title: text, dueDate, dueTime, endTime };
}

function nextWeekday(from: Date, targetDow: number): Date {
  const fromDow = from.getDay();
  let diff = (targetDow - fromDow + 7) % 7;
  if (diff === 0) diff = 7;
  const d = new Date(from);
  d.setDate(from.getDate() + diff);
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
