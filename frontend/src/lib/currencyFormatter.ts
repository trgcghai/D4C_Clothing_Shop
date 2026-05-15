const formatCurrency = (
  value: number,
  locale: string = "vi-VN",
  currency: string = "VND",
): string => {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  });
  return formatter.format(value);
};

export { formatCurrency };
