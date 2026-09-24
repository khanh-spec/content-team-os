/** Case/diacritics-insensitive name matching used to link businesses across sources. */
export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|hotel|resort|and|spa|villa|villas|boutique|restaurant)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameBusiness(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  // "Little Hoi An" ~ "Little Hoi An Boutique Hotel & Spa", but a bare place
  // name ("Hoi An") must not match every business that contains it.
  return short.length >= 5 && `${long} `.startsWith(`${short} `);
}
