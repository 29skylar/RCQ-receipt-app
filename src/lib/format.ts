import { EXCHANGE_RATES } from "./constants";
import type { Currency } from "./types";

export function getExchangeRate(currency: Currency | ""): number {
  if (!currency) return 0;
  return EXCHANGE_RATES[currency];
}

export function calculateHkdPremium(premiums: number | "", currency: Currency | ""): number {
  if (!currency) return 0;
  const amount = typeof premiums === "number" ? premiums : 0;
  return amount * getExchangeRate(currency);
}

export function formatCurrency(value: number, currency: "HKD" | "USD" = "HKD"): string {
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatExchangeRate(currency: Currency | ""): string {
  if (!currency) return "—";
  return getExchangeRate(currency).toFixed(2);
}

export function formatIsoDateToDisplay(isoDate: string): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function formatMonthYear(monthValue: string): string {
  if (!monthValue) return "—";
  const [year, month] = monthValue.split("-");
  if (!year || !month) return monthValue;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatCompactMonth(monthValue: string): string {
  if (!monthValue) return "—";
  const [year, month] = monthValue.split("-");
  if (!year || !month) return monthValue;
  const date = new Date(Number(year), Number(month) - 1, 1);
  const shortMonth = date.toLocaleDateString("en-GB", { month: "short" });
  return `${year.slice(-2)} ${shortMonth}`;
}
