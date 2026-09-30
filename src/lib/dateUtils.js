export function formatDate(value) {
  if (!value) return '—';
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year.slice(-2)}`;
}
