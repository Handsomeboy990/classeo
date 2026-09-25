// "1 absent", "3 absents": French takes the singular for 0 and 1.
export function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}
