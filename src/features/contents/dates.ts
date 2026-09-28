// Dates of the content form, without Zod: the form runs in the browser, and
// importing the schema module there would ship Zod, whose compiler probes
// eval (`Function("")`) and so trips the Content Security Policy.

// Today in Benin (UTC+1), as YYYY-MM-DD.
export function beninToday(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}
