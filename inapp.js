/* Threads・インスタ・LINE の中のブラウザで開いたときに、Safari（Android は Chrome）で開き直すボタンを出す。
   11/26 ユーザー「threadsで開くとうごかない。毎度Safariに手動で切り替える必要あり」
   アプリ内のブラウザは、下に引く操作でブラウザごと閉じたり、位置情報の許可が出なかったりして、地図の操作がうまくいかない。 */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  if (!/Barcelona|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua)) return;
  var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  var here = location.host + location.pathname + location.search + location.hash;
  var href = ios ? "x-safari-https://" + here
           : android ? "intent://" + here + "#Intent;scheme=https;package=com.android.chrome;end"
           : location.href;
  var app = /Barcelona/i.test(ua) ? "Threads" : /Instagram/i.test(ua) ? "インスタ" : /Line\//i.test(ua) ? "LINE" : "アプリ";
  var bar = document.createElement("div");
  bar.setAttribute("role", "note");
  bar.style.cssText = "position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:9999;" +
    "display:flex;align-items:center;gap:10px;background:#2A2522;color:#fff;border-radius:14px;padding:10px 12px;" +
    "font:600 13px/1.4 system-ui,-apple-system,'Hiragino Sans',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)";
  bar.innerHTML = '<span style="flex:1">' + app + "の中だと地図が動きにくいです。" + (ios ? "Safari" : "ブラウザ") + "で開くと快適です。</span>" +
    '<a href="' + href + '" style="flex:none;background:#E8644A;color:#fff;text-decoration:none;border-radius:999px;padding:8px 12px;font-weight:700">' +
    (ios ? "Safariで開く" : "ブラウザで開く") + "</a>" +
    '<button type="button" aria-label="とじる" style="flex:none;border:0;background:none;color:#fff;font-size:18px;padding:2px 4px">×</button>';
  bar.querySelector("button").onclick = function () { bar.remove(); };
  function add() { document.body.appendChild(bar); }
  if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();
