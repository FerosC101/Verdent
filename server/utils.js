export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const randomBetween = (min, max) => Math.random() * (max - min) + min;

export const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

export const normalize = (value, min, max) => clamp((value - min) / (max - min), 0, 1);

export const delta = (before, after) => Number((after - before).toFixed(2));

export const plusMinus = (v, precision = 1) => {
  const rounded = Number(v.toFixed(precision));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
};
