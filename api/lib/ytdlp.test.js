const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyYtDlpError } = require("./ytdlp");

test("classifies HTTP 404 errors as unsupported/private media", () => {
  const result = classifyYtDlpError({
    message:
      "Command failed with exit code 1: ERROR: [generic] Unable to download webpage: HTTP Error 404: Not Found",
  });

  assert.deepEqual(result, {
    status: 422,
    error:
      "yt-dlp could not find media at this URL. It may be private or unsupported.",
  });
});

test("classifies private video errors as private media", () => {
  const result = classifyYtDlpError({
    message: "ERROR: This video is private",
  });

  assert.deepEqual(result, {
    status: 422,
    error: "This media is private.",
  });
});

test("leaves unrelated errors unclassified", () => {
  const result = classifyYtDlpError({
    message: "Command failed with exit code 1: something unexpected happened",
  });

  assert.equal(result, null);
});
