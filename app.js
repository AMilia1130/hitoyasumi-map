/* ひとやすみマップ
   東京都内の 授乳・おむつ替え・ミルクのお湯・ごはん・遊び場・児童館 を、いまいる場所から近い順に出す。
   データは data/tokyo.json（公開データをまとめたもの）だけ。現在地は端末の中でしか使わない。 */
(function () {
  "use strict";

  var I = {   // アイコン（24×24・線）
    junyu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 6.5V4.8a1.5 1.5 0 0 1 3 0v1.7"/><rect x="9" y="6.5" width="6" height="2.6" rx="1"/><path d="M8 12.2a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z"/><path d="M8 13.5h2.6M8 16.5h2.6"/></svg>',
    omutsu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5h17v3.2c0 4.6-3.8 8.3-8.5 8.3s-8.5-3.700-8.500-8.300z"/><path d="M3.500 11c3.200 0 5.200 2.200 5.700 6.500M20.500 11c-3.200 0-5.200 2.200-5.700 6.500"/></svg>',
    oyu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.300c3.300 3.900 6 6.800 6 10.200a6 6 0 0 1-12 0c0-3.400 2.700-6.300 6-10.200z"/><path d="M9.300 14.200a2.800 2.800 0 0 0 2.300 2.700"/></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v6.500a2.500 2.500 0 0 0 5 0V3M8.500 3v18"/><path d="M16.500 3c-1.900 0-3 2.300-3 5s1.100 4.500 3 4.500V21M16.500 3v9.500"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.500"/><path d="M4.500 8.500c4 1 6.500 4 7 11.500M19.500 8.500c-4 1-6.500 4-7 11.500M6 6c3.500 2.500 8.500 2.500 12 0"/></svg>',
    jido: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.200 12 4.500l8 6.700V20H4z"/><path d="M12 17.200s-3-1.900-3-3.900a1.700 1.700 0 0 1 3-1 1.700 1.700 0 0 1 3 1c0 2-3 3.900-3 3.900z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.800v3.400M12 17.800v3.400M2.800 12h3.400M17.800 12h3.400"/><circle cx="12" cy="12" r="6"/></svg>'
  };
  var NEEDS = [
    { id: "junyu", label: "授乳", color: "#E8644A", on: true },
    { id: "omutsu", label: "おむつ替え", color: "#2F8FD8", on: true },
    { id: "oyu", label: "ミルクのお湯", color: "#E2A019", on: false },
    { id: "food", label: "ごはん", color: "#8A63D2", on: false },
    { id: "play", label: "あそぶ", color: "#1FA676", on: false },
    { id: "jido", label: "児童館", color: "#DB5C8D", on: false }
  ];
  var NEED = {};
  NEEDS.forEach(function (n) { NEED[n.id] = n; });
  var FEAT = { junyu: "授乳", omutsu: "おむつ替え", oyu: "お湯", kids: "キッズスペース", bcar: "ベビーカーOK" };
  // 本物の写真（自由に使えるよう公開されているもの・出典つき）がある場所だけ写真を出す。イラストは使わない（11/18 ユーザー）
  function pic(p) { return p.img ? { src: p.img[0], real: true } : null; }
  var AREAS = [["渋谷", 35.6581, 139.7017], ["新宿", 35.6896, 139.7006], ["池袋", 35.7295, 139.7109], ["銀座", 35.6717, 139.7650],
    ["六本木", 35.6628, 139.7314], ["二子玉川", 35.6116, 139.6266], ["自由が丘", 35.6076, 139.6688], ["吉祥寺", 35.7031, 139.5798],
    ["上野", 35.7138, 139.7773], ["豊洲", 35.6549, 139.7965], ["立川", 35.6979, 139.4138], ["町田", 35.5420, 139.4455]];
  var RADII = [500, 1000, 2000, 4000];

  var st = { places: [], sources: [], grid: {}, center: null, label: "", results: [], radius: 0, sel: null, view: "hello", full: false, ready: false };
  var $ = function (id) { return document.getElementById(id); };
  var sheet = $("sheet"), body = $("sheet-body"), hereBtn = $("here"), locateBtn = $("locate");
  var wide = window.matchMedia("(min-width: 900px)");

  /* ---------- 地図 ---------- */
  var map = L.map("map", { zoomControl: true, preferCanvas: true, zoomSnap: .5 }).setView([35.676, 139.70], 11.5);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, minZoom: 9, className: "tiles",
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  var dots = L.layerGroup().addTo(map), pins = L.layerGroup().addTo(map), meLayer = L.layerGroup().addTo(map);
  var markers = {};
  map.on("dragend", function () {
    var c = map.getCenter();
    if (st.view !== "detail" && (!st.center || dist(st.center, { lat: c.lat, lng: c.lng }) > 250)) hereBtn.hidden = false;
  });

  /* ---------- 道具 ---------- */
  function dist(a, b) {
    var R = 6371000, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmt(m) { return m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + "m" : (m / 1000).toFixed(1) + "km"; }
  function walk(m) { return "徒歩" + Math.max(1, Math.round(m / 67)) + "分"; }      // 子連れのゆっくりめ（分速67m）
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function matches(p, id) { return (id === "food" || id === "jido" || id === "play") ? p.c === id : p.f.indexOf(id) >= 0; }
  function mainNeed(p) {   // 選んでいる「さがしたいもの」のうち、この場所が当てはまる最初のもの（ピンの色）
    for (var i = 0; i < NEEDS.length; i++) if (NEEDS[i].on && matches(p, NEEDS[i].id)) return NEEDS[i];
    return NEED[p.c] || NEEDS[0];
  }
  function tFetch(url, ms) {
    var ctl = new AbortController(), id = setTimeout(function () { ctl.abort(); }, ms);
    return fetch(url, { signal: ctl.signal }).finally(function () { clearTimeout(id); });
  }
  function insets() {   // 地図のうち、上のバーと下のシートに隠れていない部分
    if (wide.matches) return { top: 30, bottom: 30 };
    return { top: document.querySelector(".topbar").getBoundingClientRect().bottom + 16, bottom: sheet.getBoundingClientRect().height + 16 };
  }
  /* ---------- 下の板（スマホ）: 指で上下に引いて3段階に止まる（11/23 ユーザー「スクロールできない・操作性」） ---------- */
  var SNAP = [0.28, 0.52, 0.9];
  st.snap = 1;
  function setSnap(i, instant) {
    st.snap = Math.max(0, Math.min(2, i));
    if (wide.matches) { sheet.style.height = ""; layout(); return; }
    sheet.style.transition = instant ? "none" : "";
    // いちばん広げたときも、上の検索とボタンは隠さない
    var topLimit = window.innerHeight - document.querySelector(".topbar").getBoundingClientRect().bottom - 6;
    sheet.style.height = Math.round(Math.min(window.innerHeight * SNAP[st.snap], topLimit)) + "px";
    var tg = $("toggle");
    if (tg) tg.textContent = st.snap >= 2 ? "地図を見る" : "一覧を広げる";
    setTimeout(layout, 260);
  }
  (function dragSheet() {
    var y0 = 0, h0 = 0, t0 = 0, dragging = false, fromBody = false;
    function start(e, inBody) {
      if (wide.matches) return;
      fromBody = inBody;
      y0 = e.touches[0].clientY; h0 = sheet.getBoundingClientRect().height; t0 = Date.now(); dragging = !inBody;
    }
    function move(e) {
      if (wide.matches) return;
      var dy = e.touches[0].clientY - y0;
      // 一覧の中: いちばん上までスクロールしていて、下へ引いたときだけ板を動かす
      if (fromBody && !dragging) {
        if (body.scrollTop <= 0 && dy > 8 && st.snap > 0) { dragging = true; y0 = e.touches[0].clientY; h0 = sheet.getBoundingClientRect().height; dy = 0; }
        else return;
      }
      if (!dragging) return;
      e.preventDefault();
      var h = Math.max(window.innerHeight * 0.18, Math.min(window.innerHeight - document.querySelector(".topbar").getBoundingClientRect().bottom - 6, h0 - dy));
      sheet.style.transition = "none";
      sheet.style.height = h + "px";
    }
    function end(e) {
      if (!dragging) return;
      dragging = false;
      var h = sheet.getBoundingClientRect().height / window.innerHeight;
      var y1 = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : y0;
      var v = (y0 - y1) / Math.max(1, Date.now() - t0);   // 上向きが正（px/ms）
      var best = 0;
      SNAP.forEach(function (s, i) { if (Math.abs(s - h) < Math.abs(SNAP[best] - h)) best = i; });
      if (v > 0.5) best = Math.min(2, Math.max(best, st.snap + 1));
      if (v < -0.5) best = Math.max(0, Math.min(best, st.snap - 1));
      setSnap(best);
    }
    sheet.addEventListener("touchstart", function (e) {
      if (e.target.closest("#grip") || e.target.closest(".head")) start(e, false);
      else if (e.target.closest("#sheet-body")) start(e, true);
    }, { passive: true });
    sheet.addEventListener("touchmove", move, { passive: false });
    sheet.addEventListener("touchend", end);
    sheet.addEventListener("touchcancel", end);
  })();

  function layout() {
    document.documentElement.style.setProperty("--top-h", document.querySelector(".topbar").getBoundingClientRect().height + "px");
    document.documentElement.style.setProperty("--sheet-h", (wide.matches ? 0 : sheet.getBoundingClientRect().height) + "px");
  }

  /* ---------- あると助かるもの（楽天の紹介リンク。詳しい画面の下に小さく2つまで） ---------- */
  var picks = {};
  fetch("data/picks.json?v=1").then(function (r) { return r.ok ? r.json() : {}; }).then(function (js) { picks = js || {}; }).catch(function () {});
  function picksHtml(p) {
    var list = picks[p.f.indexOf("junyu") >= 0 ? "junyu" : p.f.indexOf("omutsu") >= 0 ? "omutsu" : p.f.indexOf("oyu") >= 0 ? "oyu" : p.c] || [];
    if (!list.length) return "";
    return '<section class="picks"><h3>おでかけに、あると助かるもの</h3><div class="pick-row">' + list.slice(0, 2).map(function (x) {
      return '<a class="pick" href="' + esc(x.u) + '" target="_blank" rel="noopener sponsored"><img src="' + esc(x.img) + '" alt="" loading="lazy"><span>' + esc(x.n) + "<small>楽天市場で見る</small></span></a>";
    }).join("") + "</div>" +
      // 11/27 Amazon アソシエイト（yorupapanight-22）: 同じ品を Amazon でさがす検索リンク。値段は出さない
      '<a class="amz-link" href="https://www.amazon.co.jp/s?k=' + encodeURIComponent(list[0].n.replace(/（.*?）/g, "")) + '&tag=yorupapanight-22" target="_blank" rel="noopener sponsored">Amazon でもさがす（価格はリンク先で）→</a>' +
      '<p class="aff">楽天市場とAmazonの紹介リンクです。ここから買うと、運営者に紹介料が入ります。Amazonのアソシエイトとして、ひとやすみマップは適格販売により収入を得ています。</p></section>';
  }

  /* ---------- データ ---------- */
  // 古いデータが残らないように、毎回サーバーに確かめる（cache: "no-cache"）
  var loading = fetch("data/tokyo.json?v=9", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (js) {
    st.places = js.places; st.sources = js.sources; st.date = js.date;
    js.places.forEach(function (p, i) {
      p.i = i;
      var k = Math.floor(p.lat * 100) + "," + Math.floor(p.lng * 100);
      (st.grid[k] = st.grid[k] || []).push(p);
    });
    st.ready = true;
    $("sources").innerHTML = js.sources.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    $("data-date").textContent = " データの作成日: " + js.date;
    if (!st.center) {   // 場所を選ぶ前は、授乳できる場所を小さな点で出しておく（どのあたりにあるかが分かる）
      drawDots();
      if (st.view === "hello") renderHello();
    }
  }).catch(function () { st.failed = true; if (st.view === "hello") renderHello(); });

  function near(c, radius) {
    var out = [], dLat = radius / 111000, dLng = radius / 91000;
    for (var a = Math.floor((c.lat - dLat) * 100); a <= Math.floor((c.lat + dLat) * 100); a++)
      for (var b = Math.floor((c.lng - dLng) * 100); b <= Math.floor((c.lng + dLng) * 100); b++)
        (st.grid[a + "," + b] || []).forEach(function (p) { var d = dist(c, p); if (d <= radius) { p.d = d; out.push(p); } });
    return out;
  }

  /* ---------- さがす ---------- */
  function search(c, label) {
    if (!(c.lat > 35.4 && c.lat < 35.95 && c.lng > 138.9 && c.lng < 139.95)) {
      st.view = "hello"; renderHello("いまは東京都内だけに対応しています。都内の駅名・住所でさがしてください。");
      return;
    }
    st.center = c; st.label = label || ""; st.sel = null; hereBtn.hidden = true;
    loading.then(function () {
      dots.clearLayers(); meLayer.clearLayers();
      L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "", html: '<span class="me"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, keyboard: false }).addTo(meLayer);
      compute(); st.view = "results"; renderResults(true);
      try { history.replaceState(null, "", "?q=" + c.lat.toFixed(5) + "," + c.lng.toFixed(5) + (label ? "&n=" + encodeURIComponent(label) : "")); } catch (e) { /* file:// など */ }
    });
  }
  function compute() {
    var on = NEEDS.filter(function (n) { return n.on; });
    var pick = function (r) {
      return near(st.center, r).filter(function (p) { return on.some(function (n) { return matches(p, n.id); }); });
    };
    var res = [], r = RADII[0];
    for (var i = 0; i < RADII.length; i++) { r = RADII[i]; res = pick(r); if (res.length >= 8) break; }
    res.sort(function (x, y) { return x.d - y.d; });
    st.results = res.slice(0, 60); st.total = res.length; st.radius = r;
  }

  /* ---------- 画面 ---------- */
  function tagsHtml(p) {
    var h = "";
    if (p.w) h += '<span class="tag warn">女性のみ</span>';
    ["junyu", "omutsu", "oyu", "kids", "bcar"].forEach(function (f) {
      if (p.f.indexOf(f) < 0) return;
      var n = NEED[f], on = n && n.on;
      h += '<span class="tag' + (on ? " on" : "") + '"' + (on ? ' style="--tc:' + n.color + '"' : "") + ">" + FEAT[f] + "</span>";
    });
    return h;
  }
  function drawDots() {
    dots.clearLayers();
    st.places.forEach(function (p) {
      if (p.f.indexOf("junyu") >= 0) L.circleMarker([p.lat, p.lng], { radius: 2.6, stroke: false, fillColor: "#E8644A", fillOpacity: .5, interactive: false }).addTo(dots);
    });
  }
  function goHome() {
    st.center = null; st.label = ""; st.sel = null; st.results = [];
    var q = $("place"); if (q) q.value = "";
    meLayer.clearLayers(); pins.clearLayers();
    if (st.ready) drawDots();
    map.setView([35.676, 139.70], 11.5, { animate: false });
    renderHello();
  }
  function renderHello(msg) {
    st.view = "hello"; sheet.className = "sheet";
    if (!wide.matches) setSnap(1, true);
    pins.clearLayers(); markers = {};
    var count = st.ready ? "東京都内 " + st.places.length.toLocaleString() + " か所" : st.failed ? "" : "データを読みこんでいます…";
    body.innerHTML = '<div class="hello"><h2>いま、どこにいますか？</h2><p>近くの授乳室・おむつ替え・ミルクのお湯をすぐ出します。' + (count ? "<br>" + count : "") + "</p>" +
      '<button class="big" id="big-loc" type="button">' + I.pin + "現在地の近くをさがす</button>" +
      '<div class="areas">' + AREAS.map(function (a, i) { return '<button type="button" data-a="' + i + '">' + a[0] + "</button>"; }).join("") +
      '<a class="more-areas" href="areas.html">ほかの駅・区市町村 →</a></div>' +
      '<a class="price-link" href="omutsu.html"><b>おむつ・ミルクの値段くらべ</b><span>1枚あたり・100gあたりで安い順に</span></a>' +
      '<a class="price-link" href="money.html"><b>子育てのお金・制度と安全</b><span>018サポート・医療費控除・育休の上乗せ・冬のSIDS</span></a>' +
      '<a class="shelf-link" href="https://room.rakuten.co.jp/yorupapa_night/collection/1800012917458221" target="_blank" rel="noopener sponsored">はじめてのお出かけの持ち物（楽天ROOM）→</a></div>' +
      (msg ? '<p class="note err">' + esc(msg) + "</p>" : "") +
      (st.failed ? '<p class="note err">データを読みこめませんでした。電波のよいところで、ページを開き直してください。</p>' : "");
    $("big-loc").onclick = locate;
    Array.prototype.forEach.call(body.querySelectorAll("[data-a]"), function (b) {
      b.onclick = function () { var a = AREAS[b.dataset.a]; search({ lat: a[1], lng: a[2] }, a[0] + "駅"); };
    });
    layout();
  }
  function renderResults(refit) {
    st.view = "results";
    sheet.className = "sheet";
    pins.clearLayers(); markers = {};
    var names = NEEDS.filter(function (n) { return n.on; }).map(function (n) { return n.label; });
    var where = st.label ? esc(st.label) + "のまわり" : "このあたり";
    // 11/26 ユーザー「検索後にトップに戻り方がわからん」→ 一覧の上に「はじめにもどる」を常に出す
    var html = '<button class="home-back" id="home-back" type="button">← はじめにもどる</button><div class="head"><h2>' + where + "<small>" + (st.results.length ? fmt(st.radius) + "以内・" + st.total + "件" + (st.total > 60 ? "（近い順に60件）" : "") : names.join("・")) + "</small></h2>" +
      (st.results.length ? '<button class="toggle" id="toggle" type="button">' + (st.snap >= 2 ? "地図を見る" : "一覧を広げる") + "</button>" : "") + "</div>";
    if (!names.length) html += '<p class="note">上の「授乳」「おむつ替え」などから、さがしたいものを選んでください。</p>';
    else if (!st.results.length) html += '<p class="note">' + fmt(RADII[RADII.length - 1]) + "以内には見つかりませんでした。さがしたいものを足すか、場所を変えてみてください。</p>";
    html += '<ol class="cards" id="cards">' + st.results.map(function (p) {
      var n = mainNeed(p);
      var ph = pic(p);
      var thumb = ph ? '<span class="thumb"><img src="' + esc(ph.src) + '" alt="" loading="lazy" decoding="async"><span class="ico">' + I[n.id] + "</span></span>"
                     : '<span class="thumb none"><span class="big-ico">' + I[n.id] + "</span></span>";
      return '<li><button type="button" class="card" data-i="' + p.i + '" style="--c:' + n.color + '">' + thumb +
        '<span class="name">' + esc(p.n) + '</span><span class="sub"><b>' + fmt(p.d) + "</b>・" + walk(p.d) + (p.h ? "　" + esc(p.h) : "") + "</span>" +
        '<span class="tags">' + tagsHtml(p) + "</span></button></li>";
    }).join("") + "</ol>";
    body.innerHTML = html; body.scrollTop = 0;
    st.results.forEach(function (p) {
      var n = mainNeed(p);
      var m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: '<span class="pin" style="--c:' + n.color + '">' + I[n.id] + "</span>", iconSize: [30, 30], iconAnchor: [15, 15] }), title: p.n });
      m.on("click", function () { openDetail(p); });
      m.addTo(pins); markers[p.i] = m;
    });
    var tg = $("toggle");
    if (tg) tg.onclick = function () { setSnap(st.snap >= 2 ? 0 : 2); };
    $("home-back").onclick = goHome;
    var cards = $("cards");
    Array.prototype.forEach.call(cards.querySelectorAll(".card"), function (b) {
      b.onclick = function () { openDetail(st.places[b.dataset.i]); };
      b.onmouseenter = function () { if (wide.matches) select(Number(b.dataset.i), false); };
    });
    layout();
    if (refit) fit();
    if (refit && !wide.matches) setSnap(1, true);
  }
  function fit() {
    var pts = st.results.slice(0, 12).map(function (p) { return [p.lat, p.lng]; });
    pts.push([st.center.lat, st.center.lng]);
    var ins = insets();
    if (pts.length === 1) { map.setView(pts[0], 15, { animate: false }); return; }
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [28, ins.top + 10], paddingBottomRight: [28, ins.bottom + 10], maxZoom: 17, animate: false });
  }
  function select(i, pan) {
    if (st.sel != null && markers[st.sel]) { var o = markers[st.sel].getElement(); if (o) o.firstChild.classList.remove("sel"); markers[st.sel].setZIndexOffset(0); }
    st.sel = i;
    var m = markers[i];
    if (m) { var e = m.getElement(); if (e) e.firstChild.classList.add("sel"); m.setZIndexOffset(1000); }
    Array.prototype.forEach.call(body.querySelectorAll(".card"), function (b) { b.classList.toggle("sel", Number(b.dataset.i) === i); });
    if (pan && m) focus(m.getLatLng());
  }
  function focus(ll) {   // 隠れていない部分のまん中にピンが来るように動かす
    var ins = insets(), size = map.getSize();
    var pt = map.latLngToContainerPoint(ll);
    var target = L.point(size.x / 2, ins.top + (size.y - ins.top - ins.bottom) / 2);
    if (pt.x < 30 || pt.x > size.x - 30 || pt.y < ins.top || pt.y > size.y - ins.bottom) map.panBy(pt.subtract(target), { animate: true, duration: .35 });
  }
  function openDetail(p) {
    st.view = "detail"; sheet.className = "sheet"; hereBtn.hidden = true;
    if (!wide.matches && st.snap < 1) setSnap(1, true);
    select(p.i, false);
    var n = mainNeed(p), d = st.center ? dist(st.center, p) : null;
    var feats = ["junyu", "omutsu", "oyu", "kids", "bcar"].filter(function (f) { return p.f.indexOf(f) >= 0; });
    var ico = { junyu: I.junyu, omutsu: I.omutsu, oyu: I.oyu, kids: I.play, bcar: I.jido };
    var full = { junyu: "授乳できる", omutsu: "おむつ替えできる", oyu: "ミルクのお湯がある", kids: "キッズスペース", bcar: "ベビーカーで入れる" };
    var col = { junyu: NEED.junyu.color, omutsu: NEED.omutsu.color, oyu: NEED.oyu.color, kids: NEED.play.color, bcar: "#6F665F" };
    var rows = [];
    if (p.h) rows.push(["時間", esc(p.h)]);
    if (p.a) rows.push(["住所", esc(p.a)]);
    if (p.st) rows.push(["最寄り", esc(p.st)]);
    if (p.m && p.m.length) rows.push(["メモ", p.m.map(esc).join("<br>")]);
    var gmap = "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng + "&travelmode=walking";
    var ph = pic(p);
    var gphoto = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.n + " " + (p.a || "").split(" ")[0]);
    body.innerHTML = '<div class="detail"><button class="back" id="back" type="button">← もどる</button>' +
      (ph ? '<figure class="hero"><img src="' + esc(ph.src) + '" alt="' + esc(p.n) + 'の写真"><figcaption>写真: <a href="' + esc(p.img[3]) + '" target="_blank" rel="noopener">' + esc(p.img[1]) + "</a>（" + esc(p.img[2]) + "・ウィキメディア・コモンズ）" + (p.img[4] ? "。" + esc(p.img[4]) : "") + "</figcaption></figure>"
          : '<a class="nophoto" href="' + gphoto + '" target="_blank" rel="noopener">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><circle cx="12" cy="12.5" r="3.6"/><path d="M8.5 6l1.5-2.2h4L15.5 6"/></svg><span>実際の写真を見る<small>Googleマップで開きます</small></span></a>') +
      "<h2>" + esc(p.n) + '</h2><p class="kind">' + esc(p.t || n.label) + "</p>" +
      (d != null ? '<p class="dist">' + fmt(d) + "・" + walk(d) + "</p>" : "") +
      (feats.length || p.w ? '<ul class="feats">' + (p.w ? '<li class="warn">女性のみ利用できる</li>' : "") + feats.map(function (f) { return '<li style="--c:' + col[f] + '">' + ico[f] + full[f] + "</li>"; }).join("") + "</ul>" : "") +
      (rows.length ? '<dl class="rows">' + rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>" : "") +
      '<div class="actions"><a class="go" href="' + gmap + '" target="_blank" rel="noopener">ここへの道順（Googleマップ）</a>' +
      (ph ? '<a class="photos" href="' + gphoto + '" target="_blank" rel="noopener">ほかの写真を見る（Googleマップ）</a>' : "") +
      (p.u ? '<a href="' + esc(p.u) + '" target="_blank" rel="noopener">公式サイト</a>' : "") +
      (p.tel ? '<a href="tel:' + esc(p.tel) + '">電話する</a>' : "") +
      '<button type="button" id="share">場所を共有</button></div>' +
      picksHtml(p) +
      '<p class="source">出どころ: ' + esc(st.sources[p.src] || "") + "。設備や時間は変わることがあります。行く前にたしかめてください。" +
      (p.o ? ' <a href="https://www.openstreetmap.org/' + ({ n: "node", w: "way", r: "relation" })[p.o[0]] + "/" + p.o.slice(1) + '" target="_blank" rel="noopener">情報を直す</a>' : "") + "</p></div>";
    body.scrollTop = 0;
    $("back").onclick = function () { if (st.center) renderResults(false); else renderHello(); };
    $("share").onclick = function () {
      var url = location.origin + location.pathname + "?q=" + p.lat + "," + p.lng + "&n=" + encodeURIComponent(p.n);
      if (navigator.share) navigator.share({ title: p.n + "｜ひとやすみマップ", url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { $("share").textContent = "リンクをコピーしました"; });
    };
    layout();
    if (!wide.matches) { var z = Math.max(map.getZoom(), 16); map.setView([p.lat, p.lng], z, { animate: false }); map.panBy([0, (sheet.getBoundingClientRect().height - insets().top) / 2 - 10], { animate: false }); }
    else focus(L.latLng(p.lat, p.lng));
  }

  /* ---------- 操作 ---------- */
  var chips = $("chips");
  NEEDS.forEach(function (n) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.style.setProperty("--c", n.color);
    b.setAttribute("aria-pressed", String(n.on));
    b.innerHTML = I[n.id] + esc(n.label);
    b.onclick = function () {
      n.on = !n.on; b.setAttribute("aria-pressed", String(n.on));
      if (st.center) { compute(); renderResults(true); }
    };
    chips.appendChild(b);
  });
  function locate() {
    if (!navigator.geolocation) { renderHello("この端末では現在地を取れません。駅名・住所でさがしてください。"); return; }
    locateBtn.classList.add("busy");
    navigator.geolocation.getCurrentPosition(function (pos) {
      locateBtn.classList.remove("busy");
      search({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "現在地");
    }, function () {
      locateBtn.classList.remove("busy");
      renderHello("現在地を取れませんでした。位置情報を許可するか、駅名・住所でさがしてください。");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }
  locateBtn.onclick = locate;
  hereBtn.onclick = function () { var c = map.getCenter(); search({ lat: c.lat, lng: c.lng }, ""); };
  $("grip").onclick = function () { setSnap(st.snap >= 2 ? 1 : st.snap + 1); };
  // 地図を触ったら板を下げて、地図を広く見せる
  map.on("click", function () { if (!wide.matches && st.view !== "hello") setSnap(0); });
  window.addEventListener("resize", function () { if (!wide.matches) setSnap(st.snap, true); else sheet.style.height = ""; });
  $("about-btn").onclick = function () { $("about").showModal(); };
  $("about").addEventListener("click", function (e) { if (e.target === $("about")) $("about").close(); });
  $("place-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("place").value.trim();
    if (!q) return;
    $("place").blur(); locateBtn.classList.add("busy");
    geocode(q).then(function (c) {
      locateBtn.classList.remove("busy");
      if (!c) { renderHello("「" + q + "」が見つかりませんでした。駅名は「◯◯駅」、住所は区や市から入れてみてください。"); return; }
      search(c, q);
    });
  });
  function geocode(q) {
    var nom = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jp&accept-language=ja&limit=1&viewbox=138.9,35.95,139.95,35.4&q=" + encodeURIComponent(q);
    var gsi = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(/^東京/.test(q) ? q : "東京都" + q);
    return tFetch(nom, 8000).then(function (r) { return r.json(); }).then(function (js) {
      if (js && js[0]) return { lat: Number(js[0].lat), lng: Number(js[0].lon) };
      throw new Error("none");
    }).catch(function () {
      return tFetch(gsi, 8000).then(function (r) { return r.json(); }).then(function (js) {
        return js && js[0] ? { lat: js[0].geometry.coordinates[1], lng: js[0].geometry.coordinates[0] } : null;
      }).catch(function () { return null; });
    });
  }
  window.addEventListener("resize", layout);
  wide.addEventListener("change", function () { layout(); map.invalidateSize(); if (st.view === "results") renderResults(true); });

  /* ---------- はじまり ---------- */
  renderHello();
  var qs = new URLSearchParams(location.search), q = (qs.get("q") || "").split(",");
  if (q.length === 2 && isFinite(Number(q[0])) && isFinite(Number(q[1]))) search({ lat: Number(q[0]), lng: Number(q[1]) }, qs.get("n") || "");
})();
