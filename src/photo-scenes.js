  // ---- Painted season backgrounds ----
  // Each season is a painted picture of the cottage (bg/<season>-landscape.webp, or -portrait.webp on tall
  // screens), with its two clouds lifted out as separate pictures so they can drift. Everything that moves is
  // drawn on top: chimney smoke, flickering windows, and each season's own weather and wildlife.
  // Positions below are in the coordinates of the 4x master pictures (3320 x 1860); PHOTO_GEO maps them onto
  // the landscape and portrait pictures: land = [scale, crop left, crop top], port = [scale, sky added on top].
  var PHOTO_GEO = {
    winter: { land: [0.77419, 5, 0], port: [0.94737, 1358], clouds: { big: [2285, 183, 448, 195], small: [1055, 403, 426, 146] }, chimney: [1020, 642], windows: [[460, 1144, 180, 186], [924, 1144, 162, 180], [280, 1152, 64, 108]] },
    spring: { land: [0.77419, 6, 0], port: [0.94737, 1358], clouds: { big: [2269, 184, 437, 194], small: [1028, 403, 436, 146] }, chimney: [1002, 672], windows: [[436, 1144, 184, 186], [910, 1144, 160, 180], [256, 1152, 68, 108]] },
    summer: { land: [0.77253, 2, 0], port: [0.94737, 1354], clouds: { big: [2287, 165, 447, 194], small: [1049, 383, 448, 146] }, chimney: [1022, 654], windows: [[460, 1124, 180, 186], [930, 1124, 160, 186], [280, 1132, 64, 118]] },
    autumn: { land: [0.77253, 4, 0], port: [0.94737, 1354], clouds: { big: [2268, 165, 438, 195], small: [1033, 383, 428, 147] }, chimney: [1002, 654], windows: [[436, 1124, 184, 186], [910, 1124, 160, 186], [256, 1132, 68, 118]] },
    // The alternative scenes. Their master pictures have other sizes (master), and their portraits are cut from a
    // part of the picture (port's third number is where that cut starts). Positions are in master coordinates.
    'winter-alt': { master: [6144, 2032], land: [0.41667, 0, -593], port: [0.55385, 1995, 0], clouds: { big: [1091, 154, 488, 210], small: [2700, 150, 553, 235] }, chimney: [1129, 519], windows: [[542, 1129, 203, 226], [1084, 1129, 192, 226], [310, 1140, 85, 124]] },
    'spring-alt': { master: [6144, 2036], land: [0.41667, 0, -592], port: [0.55385, 1992, 0], clouds: { big: [1090, 132, 487, 208], small: [2700, 130, 551, 235] }, chimney: [1131, 520], windows: [[537, 1103, 198, 209], [1091, 1103, 170, 209], [317, 1114, 68, 113]] },
    'summer-alt': { master: [2016, 956], land: [1.26984, 0, -226], port: [1.41732, 1765, 1000], clouds: { big: [309, 241, 340, 167], small: [1213, 163, 289, 117] }, windows: [[1587, 149, 48, 42]] },
    'autumn-alt': { master: [2016, 1044], land: [1.26984, 0, -114], port: [1.41732, 1640, 950], clouds: { big: [1248, 86, 334, 128] } }
  };
  // An alternative scene has its season's weather, wildlife and music.
  function photoBase(season) { return String(season).replace(/-alt$/, ''); }
  var photoState = {};   // season + orientation -> 'loading' | 'ok' | 'failed'
  function photoPortrait() { return window.innerWidth / Math.max(1, window.innerHeight) < 0.8; }
  function photoUrl(season, port) { return 'bg/' + season + '-' + (port ? 'portrait' : 'landscape') + '.webp'; }
  // A picture that could not load (no bg folder next to the page, or offline) falls back to the drawn scene.
  function photoSeason(season) { return !!PHOTO_GEO[season] && !window.unwindDrawnSeasons && photoState[season + photoPortrait()] !== 'failed'; }
  function photoReady(season) { var k = season + photoPortrait(); return photoState[k] === 'ok' || photoState[k] === 'failed'; }
  // Loads (and decodes) a season's picture, so it can fade in already drawn. Calls back either way.
  function photoLoad(season, done) {
    var port = photoPortrait(), k = season + port;
    if (photoState[k] === 'ok' || photoState[k] === 'failed') { if (done) done(); return; }
    var img = new Image(), fin = false, end = function (ok) { if (fin) return; fin = true; photoState[k] = ok ? 'ok' : 'failed'; if (done) done(); };
    photoState[k] = 'loading';
    img.onload = function () { if (img.decode) img.decode().then(function () { end(true); }, function () { end(true); }); else end(true); };
    img.onerror = function () { end(false); };
    setTimeout(function () { end(true); }, 6000);
    img.src = photoUrl(season, port);
    Object.keys(PHOTO_GEO[season].clouds).forEach(function (c) { var s = new Image(); s.src = 'bg/' + season + '-cloud-' + c + '.webp'; });
  }
  // Twelve frames of a Fowl Play bird's wingbeat (one beat lasts 250 ms), side by side in one picture.
  var birdStrips = {};
  function photoBirdStrip(color) {
    if (birdStrips[color]) return birdStrips[color];
    var cv = document.createElement('canvas'), keep = ctx; cv.width = 120 * 12; cv.height = 110;
    ctx = cv.getContext('2d');
    try { for (var i = 0; i < 12; i++) drawBird(52 + i * 120, 58, 60, color, 1, true, i * 250 / 12); } finally { ctx = keep; }
    return (birdStrips[color] = cv.toDataURL());
  }
  function photoPreloadAll() { SEASON_ORDER.forEach(function (s) { photoLoad(s); }); }
  function photoScene(season) {
    var G = PHOTO_GEO[season], port = photoPortrait(), W = port ? 1440 : 2560, H = port ? 3120 : 1440;
    var k = port ? G.port[0] : G.land[0];
    var T = function (x, y) { return port ? [(x - (G.port[2] || 0)) * k, y * k + G.port[1]] : [x * k - G.land[1], y * k - G.land[2]]; };
    // The weather and wildlife were placed on the first scenes' masters (3320 x 1860); the same spots, scaled.
    var Tw = G.master ? function (x, y) { return T(x * G.master[0] / 3320, y * G.master[1] / 1860); } : T;
    var U = port ? 2.6 : 2.2;   // size of one "design pixel" in picture units, so details read at phone size too
    var r = E.rng32(SEASON_ORDER.indexOf(season) * 977 + (port ? 5 : 1));
    var f = function (v) { return Math.round(v * 10) / 10; };
    var out = '';
    out += '<image href="' + photoUrl(season, port) + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>';
    // Clouds, drifting slowly (on tall screens a few more spread over the extra sky).
    var clouds = [];
    Object.keys(G.clouds).forEach(function (c) { var b = G.clouds[c], p = T(b[0], b[1]); clouds.push([c, p[0], p[1], b[2] * k, b[3] * k]); });
    if (port) {
      // On tall screens a few more clouds spread over the extra sky, sized like the first scenes' clouds.
      var cb = G.clouds.big, cs = G.clouds.small || G.clouds.big, sm = G.clouds.small ? 'small' : 'big', zk = G.master ? 0.94737 * 446 / cb[2] : k;
      clouds.push(['big', 760, 520, cb[2] * zk * 0.9, cb[3] * zk * 0.9], [sm, 120, 980, cs[2] * zk * 0.85, cs[3] * zk * 0.85], ['big', 980, 1500, cb[2] * zk * 0.7, cb[3] * zk * 0.7]);
    } else if (G.land[2] < -150) {
      // A wide picture shown whole has extra sky above it: a couple more clouds drift there.
      var lb = G.clouds.big, ls = G.clouds.small || G.clouds.big, lsm = G.clouds.small ? 'small' : 'big', lk = 0.77 * 446 / lb[2], sky = -G.land[2];
      clouds.push(['big', 1500, Math.max(40, sky * 0.18), lb[2] * lk * 0.8, lb[3] * lk * 0.8], [lsm, 300, Math.max(60, sky * 0.42), ls[2] * lk * 0.7, ls[3] * lk * 0.7]);
    }
    clouds.forEach(function (c, i) {
      out += '<image class="pdrift" style="--a:' + (-60 - i * 25) + ';--b:' + (90 + i * 20) + ';animation-duration:' + (70 + i * 17) + 's;animation-delay:' + (-i * 23) + 's" href="bg/' + season + '-cloud-' + c[0] + '.webp" x="' + f(c[1]) + '" y="' + f(c[2]) + '" width="' + f(c[3]) + '" height="' + f(c[4]) + '"/>';
    });
    // Warm light in the windows, flickering like a fire inside.
    (G.windows || []).forEach(function (w, i) {
      var p = T(w[0], w[1]), ww = w[2] * k, hh = w[3] * k;
      out += '<g class="pglow" style="animation-delay:' + (-i * 1.7) + 's;animation-duration:' + (5 + i) + 's"><ellipse cx="' + f(p[0] + ww / 2) + '" cy="' + f(p[1] + hh / 2) + '" rx="' + f(ww * 0.95) + '" ry="' + f(hh * 0.9) + '" fill="url(#pGlow)"/><rect x="' + f(p[0]) + '" y="' + f(p[1]) + '" width="' + f(ww) + '" height="' + f(hh) + '" rx="' + f(ww * 0.06) + '" fill="#ffcf73" opacity=".35"/></g>';
    });
    // Smoke from the chimney: soft puffs that rise, grow and fade, drifting with the wind.
    var base = photoBase(season), ch = G.chimney ? T(G.chimney[0], G.chimney[1]) : null, puffs = ch ? 7 : 0, lean = base === 'autumn' ? 150 : base === 'winter' ? 90 : 60;
    var sk = G.master ? Math.min(0.77, k * 1.09) : k;   // smoke puffs keep the first scenes' size on screen
    for (var i = 0; i < puffs; i++) {
      var pr = (34 + r() * 10) * sk;
      out += '<circle class="psmoke" style="--dx:' + Math.round(lean * sk * 2.2 + r() * 40) + ';--dy:' + Math.round(-(300 + r() * 80) * sk * 1.4) + ';animation-duration:8.4s;animation-delay:' + (-i * 1.2).toFixed(1) + 's" cx="' + f(ch[0] + (r() - 0.5) * 10 * sk) + '" cy="' + f(ch[1] - pr * 0.4) + '" r="' + f(pr) + '" fill="url(#pSmoke)"/>';
    }
    // Each season's own weather and wildlife.
    out += photoExtras(base, W, H, U, r, f, Tw, k, port);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="' + (port ? 'xMidYMax' : 'xMinYMax') + ' slice" aria-hidden="true"><defs>' +
      '<radialGradient id="pGlow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset=".55" stop-color="#ffc35c" stop-opacity=".18"/><stop offset="1" stop-color="#ffc35c" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="pSmoke"><stop offset="0" stop-color="#f7f7f9" stop-opacity=".95"/><stop offset=".55" stop-color="#e9eaef" stop-opacity=".7"/><stop offset="1" stop-color="#dfe1e8" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="pFire"><stop offset="0" stop-color="#fffbd0"/><stop offset=".35" stop-color="#f3ff8a" stop-opacity=".8"/><stop offset="1" stop-color="#d8ff5a" stop-opacity="0"/></radialGradient>' +
      '</defs>' + out + '</svg>';
  }
  // A sheet of falling (or rising) specks that repeats every H units, so it can loop without a seam: the same
  // pattern is drawn twice, one screen apart, and the sheet moves down by exactly one screen per cycle.
  function photoSheet(cls, n, W, H, r, draw, style) {
    var specks = [];
    for (var i = 0; i < n; i++) specks.push([-0.15 * W + r() * 1.3 * W, r() * H, r(), r()]);
    var body = '';
    [0, H].forEach(function (oy) { specks.forEach(function (s) { body += draw(s[0], s[1] + oy, s[2], s[3]); }); });
    return '<g class="' + cls + '" style="--h:' + H + ';' + style + '">' + body + '</g>';
  }
  function photoExtras(season, W, H, U, r, f, T, k, port) {
    var out = '', i;
    if (season === 'winter') {
      // Snow in three depths, with the odd gust pushing it sideways, and the gusts themselves as faint streaks.
      [[120, 1.6, 22, 0.6, 140], [80, 2.6, 15, 0.8, 220], [36, 3.8, 10.5, 0.95, 320]].forEach(function (L) {
        out += photoSheet('pfall', L[0], W, H, r, function (x, y, a) { return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(L[1] * U * (0.7 + a * 0.6)) + '" fill="#fff" opacity="' + f(L[3] * (0.6 + a * 0.4)) + '"/>'; }, '--g:' + L[4] + ';animation-duration:' + L[2] + 's');
      });
      for (i = 0; i < 3; i++) {
        var gy = H * (0.25 + i * 0.22) + r() * 80, gx = W * (0.1 + r() * 0.5), gl = 260 * U;
        out += '<path class="pgust" style="--d:' + Math.round(W * 0.5) + ';animation-delay:' + (-i * 4.3).toFixed(1) + 's" d="M' + f(gx) + ' ' + f(gy) + 'q' + f(gl * 0.5) + ' ' + f(-30 * U) + ' ' + f(gl) + ' 0t' + f(gl * 0.6) + ' ' + f(-12 * U) + '" fill="none" stroke="#fff" stroke-width="' + f(2.2 * U) + '" stroke-linecap="round" opacity=".55"/>';
      }
    } else if (season === 'spring') {
      // Petals drifting down from the blossom, butterflies over the flowers and a bee by the pink bush.
      var petal = function (x, y, a, b) { var s = (5 + a * 4) * U; return '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(s) + '" ry="' + f(s * 0.55) + '" transform="rotate(' + Math.round(b * 180) + ' ' + f(x) + ' ' + f(y) + ')" fill="' + (b > 0.5 ? '#f7a8c4' : '#fbc8da') + '" opacity=".9"/>'; };
      out += photoSheet('pfall', 26, W, H, r, petal, '--g:260;animation-duration:26s');
      var spots = port ? [[0.25, 0.86], [0.7, 0.9], [0.45, 0.8]] : [[0.12, 0.88], [0.86, 0.85], [0.5, 0.82]];
      for (i = 0; i < 6; i++) {
        var sp = spots[i % 3], x0 = W * sp[0] + (r() - 0.5) * 200, y0 = H * sp[1] - 300 - r() * 200;
        out += '<g class="pflutter" style="--fx:' + Math.round(240 + r() * 300) + ';--fy:' + Math.round(380 + r() * 260) + ';--r:' + Math.round(200 + r() * 300) + ';animation-duration:' + (10 + r() * 5).toFixed(1) + 's;animation-delay:' + (-r() * 14).toFixed(1) + 's">' + petal(x0, y0, r(), r()) + '</g>';
      }
      [['#ffd23f', '#f59f1a'], ['#9fd3ff', '#5a8fe0'], ['#f6b3e0', '#c65fb0']].forEach(function (c, j) {
        var sp2 = spots[j], bx = W * sp2[0], by = H * sp2[1] - 60 * U, s = 1.5 * U;
        out += '<g class="pbutter" style="--k:' + f(U) + ';animation-duration:' + (16 + j * 4) + 's;animation-delay:' + (-j * 5) + 's"><g transform="translate(' + f(bx) + ' ' + f(by) + ') scale(' + f(s) + ')">' +
          '<g class="pwingl"><path d="M0 0C-4-12-18-14-17-4-16 3-8 4 0 2ZM0 2C-6 4-12 10-8 13-4 15 0 8 0 4Z" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="1"/></g>' +
          '<g class="pwingr"><path d="M0 0C4-12 18-14 17-4 16 3 8 4 0 2ZM0 2C6 4 12 10 8 13 4 15 0 8 0 4Z" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="1"/></g>' +
          '<ellipse rx="1.6" ry="6" cy="3" fill="#3b2a24"/><path d="M-1-3-4-9M1-3 4-9" stroke="#3b2a24" stroke-width=".8" fill="none"/></g></g>';
      });
      // The same bee as the one that flies over the board in spring levels.
      var bee = T(port ? 360 : 330, 1240);
      out += '<g class="pbee" style="--k:' + f(U) + '"><g transform="translate(' + f(bee[0]) + ' ' + f(bee[1]) + ') scale(' + f(1.5 * U) + ')">' +
        '<g transform="translate(-3 -7) rotate(-23)"><g class="pbwl"><ellipse cy="-4" rx="3.6" ry="5.6" fill="#fff" fill-opacity=".85"/></g></g>' +
        '<g transform="translate(2 -7) rotate(17)"><g class="pbwr"><ellipse cy="-4" rx="3.6" ry="5.6" fill="#fff" fill-opacity=".85"/></g></g>' +
        '<path d="M-5 7-6.5 11M0 8V12M5 7 6.5 11" stroke="#222" stroke-width="1.2" stroke-linecap="round" fill="none"/>' +
        '<ellipse rx="11" ry="8" fill="#f7c948"/><path d="M-6.5-6.5h3V6.5h-3ZM-.5-7.9h3V7.9h-3Z" fill="#6b4a2b"/>' +
        '<circle cx="5.8" cy="-2" r="1.4" fill="#000"/><circle cx="9" cy="-2" r="1.4" fill="#000"/></g></g>';
    } else if (season === 'summer') {
      // Birds crossing the sky, pollen floating up in the warm air, and fireflies glowing in the bushes.
      // A few of the Fowl Play birds, flapping just as they do on the board. Their wingbeat is drawn once into a
      // strip of frames with the same drawing code, then stepped through like a flipbook.
      [[0.12, 3, 34, 0], [0.24, 2, 47, 3]].forEach(function (fl, j) {
        var by2 = H * (port ? fl[0] + 0.04 : fl[0]), bs = 0.55 * U, birds = '';
        var spots2 = [[0, 0, 1], [-120, -60, 0.85], [-140, 60, 0.9]];
        for (var q = 0; q < fl[1]; q++) {
          var strip = photoBirdStrip(E.BIRD_COLORS ? E.BIRD_COLORS[(fl[3] + q) % 5] : ['#3d8bf2', '#f2b035', '#4fb06d', '#e8669a', '#9b6bd8'][(fl[3] + q) % 5]);
          birds += '<g transform="translate(' + spots2[q][0] + ' ' + spots2[q][1] + ') scale(' + spots2[q][2] + ')"><svg x="-60" y="-55" width="120" height="110" viewBox="0 0 120 110" overflow="hidden">' +
            '<image class="pstrip" style="animation-delay:' + (-q * 0.08 - j * 0.11).toFixed(2) + 's" href="' + strip + '" width="' + (120 * 12) + '" height="110"/></svg></g>';
        }
        out += '<g class="pbird" style="--fx:' + Math.round(W * 1.35) + ';animation-duration:' + fl[2] + 's;animation-delay:' + (-j * 19) + 's"><g transform="translate(' + f(-W * 0.15) + ' ' + f(by2) + ') scale(' + f(bs) + ')">' + birds + '</g></g>';
      });
      out += photoSheet('prise', 34, W, H, r, function (x, y, a) { return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f((1.6 + a * 1.6) * U) + '" fill="#fff6c8" opacity="' + f(0.45 + a * 0.4) + '"/>'; }, '--g:120;animation-duration:38s');
      var bushes = port ? [[120, 1450], [520, 1560], [1120, 1500]] : [[150, 1450], [520, 1560], [3050, 1450], [2700, 1600]];
      for (i = 0; i < 10; i++) {
        var bb = bushes[i % bushes.length], fp = T(bb[0] + (r() - 0.5) * 300, bb[1] + (r() - 0.5) * 160);
        out += '<circle class="pfire" style="--fx:' + Math.round((r() - 0.5) * 60) + ';--fy:' + Math.round(-20 - r() * 40) + ';animation-duration:' + (2.6 + r() * 2).toFixed(1) + 's;animation-delay:' + (-r() * 4).toFixed(1) + 's" cx="' + f(fp[0]) + '" cy="' + f(fp[1]) + '" r="' + f(7 * U) + '" fill="url(#pFire)"/>';
      }
    } else if (season === 'autumn') {
      // Leaves tumbling from the trees, blown along by the wind, and the wind itself as faint streaks.
      var cols = ['#e8642a', '#f2a23a', '#c9431f', '#f7c548', '#d9822b'];
      var leaf = function (x, y, a, b) { var s = (8 + a * 5) * U; return '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + Math.round(b * 360) + ') scale(' + f(s / 10) + ')" d="M0-10C6-6 7 3 0 10-7 3-6-6 0-10Z" fill="' + cols[Math.floor(b * 5)] + '"/><path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + Math.round(b * 360) + ') scale(' + f(s / 10) + ')" d="M0-8V9" stroke="#8a3a14" stroke-width="1" opacity=".6"/>'; };
      var trees = port ? [[250, 500], [1150, 900]] : [[300, 400], [3100, 700], [2900, 1000]];
      for (i = 0; i < 14; i++) {
        var t = trees[i % trees.length], lp = T(t[0] + (r() - 0.5) * 400, t[1] + (r() - 0.5) * 300);
        out += '<g class="pflutter" style="--fx:' + Math.round((port ? 300 : 520) + r() * 400) + ';--fy:' + Math.round((port ? 900 : 700) + r() * 400) + ';--r:' + Math.round(300 + r() * 400) + ';animation-duration:' + (9 + r() * 6).toFixed(1) + 's;animation-delay:' + (-r() * 15).toFixed(1) + 's">' + leaf(lp[0], lp[1], r(), r()) + '</g>';
      }
      out += photoSheet('pfall', 14, W, H, r, leaf, '--g:420;animation-duration:20s');
      for (i = 0; i < 3; i++) {
        var wy = H * (0.3 + i * 0.2) + r() * 60, wx = W * (0.05 + r() * 0.5), wl = 300 * U;
        out += '<path class="pgust" style="--d:' + Math.round(W * 0.55) + ';animation-delay:' + (-i * 4.7).toFixed(1) + 's;animation-duration:13s" d="M' + f(wx) + ' ' + f(wy) + 'q' + f(wl * 0.5) + ' ' + f(-26 * U) + ' ' + f(wl) + ' 0t' + f(wl * 0.7) + ' ' + f(-10 * U) + '" fill="none" stroke="#fff4e0" stroke-width="' + f(2.4 * U) + '" stroke-linecap="round" opacity=".6"/>';
      }
    }
    return out;
  }
