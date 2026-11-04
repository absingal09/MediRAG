/** Ignore layout whitespace/bullets, but retain dose operators and punctuation. */
function normalize(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/\p{Pd}/gu, "-")
    .replace(/[^\p{L}\p{N}\p{S}!.%/+-]/gu, "");
}

/** Locate a whole passage exactly once. Never choose a fuzzy or ambiguous hit. */
export function matchSourceItems(items: { str: string }[], passage: string) {
  const needle = normalize(passage);
  if (needle.length < 24) return [];
  const strings = items.map((item) => normalize(item.str));
  const haystack = strings.join("");
  const start = haystack.indexOf(needle);
  if (start < 0 || haystack.indexOf(needle, start + 1) !== -1) return [];
  const end = start + needle.length;
  let offset = 0;
  return strings.flatMap((text, index) => {
    const from = offset;
    offset += text.length;
    return text.length && from < end && offset > start ? [index] : [];
  });
}
