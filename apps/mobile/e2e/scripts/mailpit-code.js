// The newest sign-in code sent to EMAIL, read from the local stack's Mailpit (never a real
// inbox). Leaves output.code unset until the email has arrived, so the flow retries.
const res = http.get(MAILPIT + '/api/v1/search?query=' + encodeURIComponent('to:' + EMAIL));
const messages = json(res.body).messages || [];
const match = messages.length > 0 ? messages[0].Snippet.match(/\b(\d{6})\b/) : null;
output.code = match ? match[1] : null;
