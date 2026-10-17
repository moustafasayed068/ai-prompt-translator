// Languages Google Translate supports as a target
const CODES = [
  "af","sq","am","ar","hy","az","eu","be","bn","bs","bg","ca","ceb","zh-CN","zh-TW",
  "co","hr","cs","da","nl","en","eo","et","fi","fr","fy","gl","ka","de","el","gu",
  "ht","ha","haw","he","hi","hmn","hu","is","ig","id","ga","it","ja","jv","kn","kk",
  "km","rw","ko","ku","ky","lo","lv","lt","lb","mk","mg","ms","ml","mt","mi","mr",
  "mn","my","ne","no","ny","or","ps","fa","pl","pt","pa","ro","ru","sm","gd","sr",
  "st","sn","sd","si","sk","sl","so","es","su","sw","sv","tl","tg","ta","tt","te",
  "th","tr","tk","uk","ur","ug","uz","vi","cy","xh","yi","yo","zu"
];

const names = new Intl.DisplayNames(["en"], { type: "language" });
const nameOf = (c) => { try { return names.of(c) || c; } catch (_) { return c; } };

const defaults = { appendReply: true, target: "en" };
const target = document.getElementById("target");
const appendReply = document.getElementById("appendReply");
const replyText = document.getElementById("replyText");

CODES.map((c) => [c, nameOf(c)])
  .sort((a, b) => a[1].localeCompare(b[1]))
  .forEach(([c, n]) => target.add(new Option(n, c)));

function updateReplyText() {
  replyText.textContent = `Add “Reply in ${nameOf(target.value)}.” at the end`;
}

chrome.storage.sync.get(defaults, (s) => {
  target.value = s.target;
  appendReply.checked = s.appendReply;
  updateReplyText();
});
target.addEventListener("change", () => {
  chrome.storage.sync.set({ target: target.value });
  updateReplyText();
});
appendReply.addEventListener("change", () => chrome.storage.sync.set({ appendReply: appendReply.checked }));
