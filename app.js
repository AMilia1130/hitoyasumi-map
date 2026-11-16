/* ひとやすみマップ: 近くの授乳室・おむつ替え・遊び場・児童館・子連れごはんを探す。
   データ: 東京都「赤ちゃん・ふらっと」（data/akachan_flat.json）＋ OpenStreetMap（Overpass API）。
   位置は端末の中で使い、近くの施設の検索のために座標だけを Overpass API に送る。保存はしない。 */
(function () {
  "use strict";

  var CATS = [
    { id: "nursing", label: "授乳・おむつ替え", color: "#D9623B", on: true },
    { id: "play", label: "遊び場", color: "#2F9E83", on: true },
    { id: "jido", label: "児童館・ひろば", color: "#C08A1E", on: true },
    { id: "food", label: "子連れごはん", color: "#7A5BB8", on: true },
    { id: "toilet", label: "トイレ（おむつ台）", color: "#3E7CB8", on: false }
  ];
  var CAT = {};
  CATS.forEach(function (c) { CAT[c.id] = c; });

  var OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  var FAMILY = "ガスト|サイゼリヤ|デニーズ|ロイヤルホスト|ジョナサン|バーミヤン|ココス|びっくりドンキー|夢庵|藍屋|しゃぶ葉|ジョイフル|和食さと|スシロー|くら寿司|はま寿司|かっぱ寿司";
  var JIDO = "児童館|児童センター|子育てひろば|子育て支援|子ども家庭支援|こども家庭|こども館|子ども館|おでかけひろば";

  var state = { center: null, radius: 1000, places: [], flat: null, bundle: null, cache: {}, selected: null, busy: false };

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $("status"), listEl = $("list"), locateBtn = $("locate"), hereBtn = $("here");

  /* ---------- 地図 ---------- */
  var map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([35.6595, 139.7005], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, minZoom: 5, className: "tiles",
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | 東京都福祉局「赤ちゃん・ふらっと一覧」'
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  var markerLayer = L.layerGroup().addTo(map);
  var centerLayer = L.layerGroup().addTo(map);
  var markers = {};
  var moved = false;   // （互換のために残す）
  // 人が地図を動かしたときだけ「この場所でさがす」を出す（プログラムの移動では出さない）
  map.on("dragend", function () {
    var c = map.getCenter();
    if (!state.center || dist(state.center, { lat: c.lat, lng: c.lng }) > 150) hereBtn.hidden = false;
  });

  /* ---------- 小さな道具 ---------- */
  function dist(a, b) {
    var R = 6371000, t = Math.PI / 180;
    var dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + "m" : (m / 1000).toFixed(1) + "km"; }
  function walk(m) { return "徒歩 約" + Math.max(1, Math.round(m / 67)) + "分"; }   // 子連れのゆっくりめ（分速67m）
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function setStatus(t, err) { statusEl.textContent = t; statusEl.className = "status" + (err ? " err" : ""); }
  function timeoutFetch(url, opt, ms) {
    var ctl = new AbortController();
    var id = setTimeout(function () { ctl.abort(); }, ms);
    opt = opt || {}; opt.signal = ctl.signal;
    return fetch(url, opt).finally(function () { clearTimeout(id); });
  }

  /* ---------- データ: 東京都 赤ちゃん・ふらっと ---------- */
  function loadFlat() {
    if (state.flat) return Promise.resolve(state.flat);
    return fetch("data/akachan_flat.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
      .then(function (js) { state.flat = js; return js; });
  }
  function flatNear(c, radius) {
    return (state.flat || []).filter(function (p) { return Math.abs(p.lat - c.lat) < 0.03 && Math.abs(p.lng - c.lng) < 0.04 && dist(c, p) <= radius; })
      .map(function (p, i) {
        var meta = [];
        if (p.d || p.h) meta.push([p.d, p.h].filter(Boolean).join(" "));
        if (p.st) meta.push("最寄り: " + p.st);
        if (p.who) meta.push("利用できる人: " + p.who);            // 「女性のみ利用できる」の届出がある施設
        if (p.pre) meta.push("授乳室の鍵: " + p.pre);
        if (p.note) meta.push(p.note);
        return { key: "f" + p.lat + "," + p.lng + p.n, cat: "nursing", name: p.n, kind: "授乳・おむつ替えスペース（東京都「赤ちゃん・ふらっと」）",
                 meta: meta, addr: p.a, lat: p.lat, lng: p.lng, sure: true, src: "tokyo" };
      });
  }

  /* ---------- データ: OpenStreetMap（東京都の分は同梱。検索サーバーが混んでいても探せる） ---------- */
  function loadBundle() {
    if (state.bundle) return Promise.resolve(state.bundle);
    return fetch("data/osm_tokyo.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (js) { state.bundle = js || { bbox: [0, 0, 0, 0], places: [] }; return state.bundle; });
  }
  function inBundle(c, r) {
    var b = state.bundle && state.bundle.bbox, pad = r / 111000;
    return !!(b && state.bundle.places.length && c.lat - pad > b[0] && c.lat + pad < b[2] && c.lng - pad * 1.25 > b[1] && c.lng + pad * 1.25 < b[3]);
  }
  function bundleNear(c, radius) {
    var dLat = radius / 111000 * 1.1, dLng = dLat * 1.25;
    return state.bundle.places.filter(function (p) { return Math.abs(p.lat - c.lat) < dLat && Math.abs(p.lng - c.lng) < dLng && dist(c, p) <= radius; })
      .map(function (p) {
        return { key: p.k, cat: p.c, name: p.n, kind: p.t, meta: p.m || [], lat: p.lat, lng: p.lng, sure: !!p.s, src: "osm",
                 osm: ({ n: "node", w: "way", r: "relation" })[p.k[0]] + "/" + p.k.slice(1) };
      });
  }

  /* ---------- データ: OpenStreetMap（都外はその場で検索） ---------- */
  function buildQuery(c, r) {
    var a = "(around:" + r + "," + c.lat.toFixed(5) + "," + c.lng.toFixed(5) + ")";
    return "[out:json][timeout:25];(" +
      "nwr" + a + '["baby_feeding"]["baby_feeding"!="no"];' +
      "nwr" + a + '["changing_table"="yes"];' +
      "nwr" + a + '["shop"~"^(department_store|mall|baby_goods)$"];' +
      "nwr" + a + '["leisure"~"^(playground|indoor_play)$"];' +
      "nwr" + a + '["name"~"' + JIDO + '"];' +
      "nwr" + a + '["amenity"="community_centre"]["community_centre:for"~"child|juvenile"];' +
      "nwr" + a + '["amenity"~"^(restaurant|cafe|fast_food)$"]["highchair"~"^(yes|limited)$"];' +
      "nwr" + a + '["amenity"~"^(restaurant|cafe|fast_food)$"]["kids_area"="yes"];' +
      "nwr" + a + '["amenity"="food_court"];' +
      "nwr" + a + '["amenity"="restaurant"]["name"~"' + FAMILY + '"];' +
      ");out tags center 500;";
  }
  function fetchOsm(c, r) {
    var key = c.lat.toFixed(3) + "," + c.lng.toFixed(3) + "," + r;
    if (state.cache[key]) return Promise.resolve(state.cache[key]);
    var q = "data=" + encodeURIComponent(buildQuery(c, r));
    var i = 0;
    function attempt() {
      if (i >= OVERPASS.length) return Promise.reject(new Error("overpass"));
      var url = OVERPASS[i++];
      return timeoutFetch(url, { method: "POST", body: q, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 14000)
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .catch(function () { return attempt(); });
    }
    return attempt().then(function (js) { state.cache[key] = js.elements || []; return state.cache[key]; });
  }
  function classify(el) {
    var t = el.tags || {};
    var lat = el.lat != null ? el.lat : el.center && el.center.lat, lng = el.lon != null ? el.lon : el.center && el.center.lon;
    if (lat == null) return null;
    var p = { key: el.type[0] + el.id, lat: lat, lng: lng, name: t.name || "", meta: [], sure: true, src: "osm", osm: el.type + "/" + el.id };
    var food = /^(restaurant|cafe|fast_food|food_court)$/.test(t.amenity || "");
    var bf = t.baby_feeding && t.baby_feeding !== "no";
    if (t.opening_hours) p.meta.push("時間: " + t.opening_hours);
    if (t.level) p.meta.push(t.level + "階");

    if (t.amenity === "toilets" && t.changing_table === "yes" && !bf) {
      p.cat = "toilet"; p.kind = "おむつ替え台のあるトイレ"; p.name = p.name || "公共トイレ";
      if (t.wheelchair === "yes") p.meta.push("車いす対応（広め）");
    } else if (food) {
      p.cat = "food";
      var why = [];
      if (/^(yes|limited)$/.test(t.highchair || "")) why.push("子ども用のいす");
      if (t.kids_area === "yes") why.push("キッズスペース");
      if (t.changing_table === "yes") why.push("おむつ替え台");
      if (bf) why.push("授乳スペース");
      if (why.length) { p.kind = "子連れ向けの設備あり（" + why.join("・") + "）"; }
      else if (t.amenity === "food_court") { p.kind = "フードコート（席が広く、子連れで入りやすい）"; p.sure = false; p.name = p.name || "フードコート"; }
      else { p.kind = "ファミリー向けのお店（子ども用のいす・メニューがあることが多い）"; p.sure = false; }
      if (!p.name) p.name = "飲食店";
    } else if (bf || t.changing_table === "yes") {
      p.cat = "nursing";
      p.kind = bf ? (t.changing_table === "yes" ? "授乳スペース・おむつ替え台" : "授乳スペース") : "おむつ替え台あり";
      p.name = p.name || "授乳・おむつ替えスペース";
    } else if (/^(playground|indoor_play)$/.test(t.leisure || "")) {
      p.cat = "play"; p.kind = t.leisure === "indoor_play" ? "屋内の遊び場" : "遊具のある広場";
      p.name = p.name || "遊び場";
    } else if (new RegExp(JIDO).test(t.name || "") || t["community_centre:for"]) {
      p.cat = "jido"; p.kind = "児童館・子育てひろば"; p.name = p.name || "児童館";
    } else if (/^(department_store|mall|baby_goods)$/.test(t.shop || "")) {
      p.cat = "nursing"; p.sure = false;
      p.kind = (t.shop === "baby_goods" ? "ベビー用品店" : t.shop === "mall" ? "ショッピングモール" : "デパート") + "（授乳室があることが多い）";
      if (!p.name) return null;
    } else { return null; }
    return p;
  }

  /* ---------- さがす ---------- */
  function search(c, label) {
    state.center = c; state.busy = true; moved = false; hereBtn.hidden = true;
    locateBtn.disabled = true;
    setStatus((label ? label + "の" : "") + "近くをさがしています…");
    centerLayer.clearLayers();
    L.circle([c.lat, c.lng], { radius: state.radius, color: "#45372F", weight: 1.5, opacity: .55, dashArray: "5 6", fillOpacity: .04, interactive: false }).addTo(centerLayer);
    L.circleMarker([c.lat, c.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#45372F", fillOpacity: 1, interactive: false }).addTo(centerLayer);
    map.fitBounds(L.latLng(c.lat, c.lng).toBounds(state.radius * 2.15), { animate: false });
    moved = false;

    function finish(osm, pending, failed) {
      if (state.center !== c) return;   // 途中で別の場所を探しはじめた
      var out = flatNear(c, state.radius).concat(osm);
      // 東京都のデータと同じ建物（60m以内）の「多い」表示は消す
      var sure = out.filter(function (p) { return p.src === "tokyo"; });
      out = out.filter(function (p) {
        if (p.sure || p.cat !== "nursing") return true;
        return !sure.some(function (s) { return dist(s, p) < 60; });
      });
      out.forEach(function (p) { p.dist = dist(c, p); });
      out.sort(function (x, y) { return x.dist - y.dist; });
      state.places = out; state.osmFailed = failed; state.pending = pending; state.label = label || "";
      render();
      if (!pending) { state.busy = false; locateBtn.disabled = false; moved = false; }
    }
    return Promise.all([loadFlat(), loadBundle()]).then(function () {
      if (inBundle(c, state.radius)) { finish(bundleNear(c, state.radius), false, false); return; }
      finish([], true, false);   // 先に東京都の授乳室だけ出して、残りは届きしだい足す
      return fetchOsm(c, state.radius).then(function (els) {
        var seen = {}, got = [];
        els.forEach(function (el) {
          var p = classify(el);
          if (!p || seen[p.key] || dist(c, p) > state.radius * 1.05) return;
          seen[p.key] = 1; got.push(p);
        });
        finish(got, false, false);
      }).catch(function () { finish([], false, true); });
    }).catch(function () { state.busy = false; locateBtn.disabled = false; setStatus("読みこみに失敗しました。電波のよいところで、もう一度お試しください。", true); });
  }

  function render() {
    var on = {};
    CATS.forEach(function (c) { on[c.id] = c.on; });
    var shown = state.places.filter(function (p) { return on[p.cat]; });
    markerLayer.clearLayers(); markers = {};
    listEl.innerHTML = "";
    shown.forEach(function (p) {
      var col = CAT[p.cat].color;
      var m = L.circleMarker([p.lat, p.lng], { radius: p.sure ? 8 : 6, color: "#fff", weight: 2, fillColor: col, fillOpacity: p.sure ? .95 : .45 }).addTo(markerLayer);
      m.bindPopup("<b>" + esc(p.name) + "</b>" + esc(p.kind) + "<br>" + fmtDist(p.dist) + "・" + walk(p.dist));
      m.on("click", function () { select(p.key, true); });
      markers[p.key] = m;
    });
    shown.slice(0, 80).forEach(function (p) {
      var li = document.createElement("li");
      li.className = "item" + (p.sure ? "" : " maybe"); li.style.setProperty("--c", CAT[p.cat].color);
      li.tabIndex = 0; li.dataset.key = p.key;
      var gmap = "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng + "&travelmode=walking";
      li.innerHTML =
        '<div class="item-head"><h3 class="item-name">' + esc(p.name) + '</h3><span class="item-dist">' + fmtDist(p.dist) + "・" + walk(p.dist) + "</span></div>" +
        '<p class="item-kind">' + esc(p.kind) + "</p>" +
        (p.addr ? '<p class="item-meta">' + esc(p.addr) + "</p>" : "") +
        p.meta.map(function (t) { return '<p class="item-meta">' + esc(t) + "</p>"; }).join("") +
        '<div class="item-actions"><a href="' + gmap + '" target="_blank" rel="noopener">ここへの道順（Googleマップ）</a>' +
        (p.osm ? '<a class="fix" href="https://www.openstreetmap.org/' + p.osm + '" target="_blank" rel="noopener">情報を直す</a>' : "") + "</div>";
      li.addEventListener("click", function (e) { if (e.target.tagName !== "A") select(p.key, false); });
      li.addEventListener("keydown", function (e) { if (e.key === "Enter") select(p.key, false); });
      listEl.appendChild(li);
    });
    var n = shown.length, r = state.radius >= 1000 ? state.radius / 1000 + "km" : state.radius + "m";
    var head = (state.label ? state.label + "から" : "この場所から") + r + "以内に " + n + "件";
    if (!n && !state.pending) head = (state.label ? state.label + "から" : "この場所から") + r + "以内には見つかりませんでした。範囲を広げるか、さがすものを増やしてみてください。";
    if (state.pending) head = (n ? head + "。" : "") + "ほかの場所もさがしています…";
    if (n > 80) head += "（近い順に80件を表示）";
    if (state.osmFailed) head = head.replace(/。$/, "") + "。いま地図データのサーバーが混んでいて、一部しか出せていません。少し待って、もう一度お試しください。";
    setStatus(head, state.osmFailed && !n);
  }

  function select(key, fromMap) {
    state.selected = key;
    Array.prototype.forEach.call(listEl.children, function (li) {
      var hit = li.dataset.key === key;
      li.classList.toggle("sel", hit);
      if (hit && fromMap) li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    var m = markers[key];
    if (m && !fromMap) { map.panTo(m.getLatLng(), { animate: true }); m.openPopup(); }
  }

  /* ---------- 操作 ---------- */
  var chips = $("chips");
  CATS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.style.setProperty("--c", c.color);
    b.setAttribute("aria-pressed", String(c.on));
    b.innerHTML = '<span class="dot"></span>' + esc(c.label);
    b.addEventListener("click", function () { c.on = !c.on; b.setAttribute("aria-pressed", String(c.on)); if (state.center) render(); });
    chips.appendChild(b);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".seg"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".seg"), function (x) { x.classList.toggle("on", x === b); });
      state.radius = Number(b.dataset.r);
      if (state.center) search(state.center, state.label);
    });
  });
  locateBtn.addEventListener("click", function () {
    if (!navigator.geolocation) { setStatus("この端末では現在地を取れません。駅名・住所でさがしてください。", true); return; }
    locateBtn.disabled = true; setStatus("現在地をたしかめています…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      search({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "現在地");
    }, function () {
      locateBtn.disabled = false;
      setStatus("現在地を取れませんでした。ブラウザの設定で位置情報を許可するか、駅名・住所でさがしてください。", true);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
  hereBtn.addEventListener("click", function () {
    var c = map.getCenter(); search({ lat: c.lat, lng: c.lng }, "");
  });
  $("place-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("place").value.trim();
    if (!q) return;
    setStatus("「" + q + "」をさがしています…");
    geocode(q).then(function (c) {
      if (!c) { setStatus("「" + q + "」の場所が見つかりませんでした。駅名は「◯◯駅」、住所は市区町村から入れてみてください。", true); return; }
      search(c, q);
    });
  });
  function geocode(q) {
    var nom = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jp&accept-language=ja&limit=1&q=" + encodeURIComponent(q);
    var gsi = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(q);
    return timeoutFetch(nom, {}, 9000).then(function (r) { return r.json(); }).then(function (js) {
      if (js && js[0]) return { lat: Number(js[0].lat), lng: Number(js[0].lon) };
      throw new Error("none");
    }).catch(function () {
      return timeoutFetch(gsi, {}, 9000).then(function (r) { return r.json(); }).then(function (js) {
        if (js && js[0]) return { lat: js[0].geometry.coordinates[1], lng: js[0].geometry.coordinates[0] };
        return null;
      }).catch(function () { return null; });
    });
  }

  // 最初は東京都の授乳室を地図にうすく出しておく（場所を選ぶ前でも、どのあたりにあるかが分かる）
  loadFlat().then(function (flat) {
    if (state.center || !flat.length) return;
    flat.forEach(function (p) {
      L.circleMarker([p.lat, p.lng], { radius: 3, stroke: false, fillColor: "#D9623B", fillOpacity: .5, interactive: false }).addTo(markerLayer);
    });
  });

  // ?lat=..&lng=.. で場所を指定して開ける（共有用）
  var qs = new URLSearchParams(location.search);
  if (qs.get("lat") && qs.get("lng")) {
    var la = Number(qs.get("lat")), ln = Number(qs.get("lng"));
    if (isFinite(la) && isFinite(ln)) search({ lat: la, lng: ln }, qs.get("name") || "");
  }
})();
