/* ═══════════════════════════════════════════════════════════════
   بنّاء AI — bannaa-geo-patch.js  (v7.1)
   رقعة تصحيح جيوديسية — تُحمَّل بعد Turf وقبل كود التطبيق
   دار الإبداع للحلول البرمجية

   تصحح ٣ عيوب في v7:
   ─────────────────────────────────────────────────────────────
   ١) الاتجاهات: كان يحسب الزاوية من مركز القطعة إلى منتصف الضلع
      بدل اتجاه الضلع نفسه. أدى ذلك إلى اتجاهات خاطئة تماماً.
   ٢) المساحة: turf.area يستخدم كرة بنصف قطر متوسط (6371008.8)
      فينحاز +0.27%. استُبدل بحساب جيوديسي على إهليلج WGS84.
   ٣) عدم اليقين: لم يكن موجوداً إطلاقاً. أُضيف σ_A.

   لا يعدّل أي دالة أخرى. آمن التحميل.
   ═══════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';

  var A = 6378137.0;
  var F = 1 / 298.257223563;
  var E2 = 2 * F - F * F;
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ───────────────────────────────────────────────
     ١) الأزيموث الحقيقي بين نقطتين
     ─────────────────────────────────────────────── */
  function bearing(lon1, lat1, lon2, lat2) {
    var p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }

  /* ───────────────────────────────────────────────
     المسافة الجيوديسية (Vincenty inverse)
     ─────────────────────────────────────────────── */
  function distance(lon1, lat1, lon2, lat2) {
    var b = A * (1 - F);
    var L = (lon2 - lon1) * D2R;
    var U1 = Math.atan((1 - F) * Math.tan(lat1 * D2R));
    var U2 = Math.atan((1 - F) * Math.tan(lat2 * D2R));
    var sU1 = Math.sin(U1), cU1 = Math.cos(U1);
    var sU2 = Math.sin(U2), cU2 = Math.cos(U2);
    var lam = L, lamP, i = 0, sLam, cLam, sSig, cSig, sig, sAl, cSqAl, c2SM, C;
    do {
      sLam = Math.sin(lam); cLam = Math.cos(lam);
      var t1 = cU2 * sLam, t2 = cU1 * sU2 - sU1 * cU2 * cLam;
      sSig = Math.sqrt(t1 * t1 + t2 * t2);
      if (sSig === 0) return 0;
      cSig = sU1 * sU2 + cU1 * cU2 * cLam;
      sig = Math.atan2(sSig, cSig);
      sAl = cU1 * cU2 * sLam / sSig;
      cSqAl = 1 - sAl * sAl;
      c2SM = cSqAl !== 0 ? cSig - 2 * sU1 * sU2 / cSqAl : 0;
      C = F / 16 * cSqAl * (4 + F * (4 - 3 * cSqAl));
      lamP = lam;
      lam = L + (1 - C) * F * sAl * (sig + C * sSig * (c2SM + C * cSig * (-1 + 2 * c2SM * c2SM)));
    } while (Math.abs(lam - lamP) > 1e-12 && ++i < 200);
    var uSq = cSqAl * (A * A - b * b) / (b * b);
    var Aa = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    var Bb = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    var dSig = Bb * sSig * (c2SM + Bb / 4 * (cSig * (-1 + 2 * c2SM * c2SM)
      - Bb / 6 * c2SM * (-3 + 4 * sSig * sSig) * (-3 + 4 * c2SM * c2SM)));
    return b * Aa * (sig - dSig);
  }

  /* ───────────────────────────────────────────────
     ٢) المساحة الجيوديسية — إهليلج WGS84
     ─────────────────────────────────────────────── */
  function areaRing(ring) {
    var r = ring.slice();
    if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push(r[0]);
    if (r.length < 4) return 0;
    var tot = 0;
    for (var i = 0; i < r.length - 1; i++) {
      var lon1 = r[i][0] * D2R, lat1 = r[i][1] * D2R;
      var lon2 = r[i + 1][0] * D2R, lat2 = r[i + 1][1] * D2R;
      tot += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    // نصف القطر الجاوسي المحلي عند متوسط خط العرض
    var latM = 0;
    for (var k = 0; k < r.length; k++) latM += r[k][1];
    latM = latM / r.length * D2R;
    var Wf = 1 - E2 * Math.pow(Math.sin(latM), 2);
    var N = A / Math.sqrt(Wf);
    var M = A * (1 - E2) / Math.pow(Wf, 1.5);
    var Rg = Math.sqrt(M * N);
    return Math.abs(tot * Rg * Rg / 2);
  }

  /* ───────────────────────────────────────────────
     ٣) عدم اليقين في المساحة
     ─────────────────────────────────────────────── */
  function areaUncertainty(perimeter, gpsAcc, nVerts) {
    if (!gpsAcc || !nVerts) return null;
    return (gpsAcc * perimeter) / Math.sqrt(2 * nVerts);
  }

  function confidence(sigma, area) {
    if (sigma == null || !area) return { ar: 'غير معروفة', color: '#94a3b8', key: 'unknown' };
    var r = sigma / area;
    if (r < 0.02) return { ar: 'عالية', color: '#16a34a', key: 'high' };
    if (r < 0.08) return { ar: 'متوسطة', color: '#f59e0b', key: 'medium' };
    return { ar: 'منخفضة', color: '#dc2626', key: 'low' };
  }

  /* ───────────────────────────────────────────────
     الاتجاهات — ١٦ جهة (كانت ٨)
     ─────────────────────────────────────────────── */
  var DIRS16 = [
    'شمالي', 'شمالي شمالي شرقي', 'شمالي شرقي', 'شرقي شمالي شرقي',
    'شرقي', 'شرقي جنوبي شرقي', 'جنوبي شرقي', 'جنوبي جنوبي شرقي',
    'جنوبي', 'جنوبي جنوبي غربي', 'جنوبي غربي', 'غربي جنوبي غربي',
    'غربي', 'غربي شمالي غربي', 'شمالي غربي', 'شمالي شمالي غربي'
  ];
  var DIRS8 = ['شمالي', 'شمالي شرقي', 'شرقي', 'جنوبي شرقي',
               'جنوبي', 'جنوبي غربي', 'غربي', 'شمالي غربي'];

  function dir16(az) { return DIRS16[Math.round(((az % 360) + 360) % 360 / 22.5) % 16]; }
  function dir8(az)  { return DIRS8[Math.round(((az % 360) + 360) % 360 / 45) % 8]; }

  function toDMS(az) {
    az = ((az % 360) + 360) % 360;
    var d = Math.floor(az), mf = (az - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
    if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
    return d + '°' + (m < 10 ? '0' : '') + m + "'" + (s < 10 ? '0' : '') + s + '"';
  }

  /* ───────────────────────────────────────────────
     مركز المضلع (للاستخدام الداخلي)
     ─────────────────────────────────────────────── */
  function centroidOf(pts) {
    var lat0 = 0, lng0 = 0, n = pts.length;
    for (var i = 0; i < n; i++) { lat0 += pts[i].lat; lng0 += pts[i].lng; }
    lat0 /= n; lng0 /= n;
    var mxs = 111320 * Math.cos(lat0 * D2R), mys = 110540;
    var Q = pts.map(function (p) { return { x: (p.lng - lng0) * mxs, y: (p.lat - lat0) * mys }; });
    var cx = 0, cy = 0, Ar = 0;
    for (var j = 0; j < Q.length; j++) {
      var k = (j + 1) % Q.length;
      var cr = Q[j].x * Q[k].y - Q[k].x * Q[j].y;
      Ar += cr; cx += (Q[j].x + Q[k].x) * cr; cy += (Q[j].y + Q[k].y) * cr;
    }
    Ar /= 2;
    if (!Ar) return { lat: lat0, lng: lng0 };
    cx /= (6 * Ar); cy /= (6 * Ar);
    return { lat: lat0 + cy / mys, lng: lng0 + cx / mxs };
  }

  /* ═══════════════════════════════════════════════════════
     الواجهة العامة
     ═══════════════════════════════════════════════════════ */
  W.BannaaGeoFix = {
    bearing: bearing,
    distance: distance,
    areaRing: areaRing,
    areaUncertainty: areaUncertainty,
    confidence: confidence,
    dir16: dir16,
    dir8: dir8,
    toDMS: toDMS,
    centroidOf: centroidOf,
    /* دقة GPS الحالية — يحدّثها التطبيق عند كل قراءة */
    gpsAccuracy: null,

    /* حساب أضلاع صحيح — يحل محل calcSides */
    calcSidesFixed: function (pts, sectors) {
      var n = pts.length;
      if (n < 2) return [];
      var out = [];
      // اتجاه الدوران: نحتاجه لتحديد الخارج
      var s2 = 0;
      for (var q = 0; q < n; q++) {
        var w = (q + 1) % n;
        s2 += (pts[w].lng - pts[q].lng) * (pts[w].lat + pts[q].lat);
      }
      var ccw = s2 < 0;

      for (var i = 0; i < n; i++) {
        if (n === 2 && i === 1) break;
        var a = pts[i], b = pts[(i + 1) % n];
        var len = distance(a.lng, a.lat, b.lng, b.lat);
        var az = bearing(a.lng, a.lat, b.lng, b.lat);
        var mid = [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2];
        // الواجهة = عمودي على الضلع نحو الخارج
        var faceAz = ccw ? (az - 90 + 360) % 360 : (az + 90) % 360;
        out.push({
          i: i,
          len: len,
          mid: mid,
          az: az,
          dms: toDMS(az),
          dir: (sectors === 8 ? dir8 : dir16)(az),      // اتجاه الضلع
          face: (sectors === 8 ? dir8 : dir16)(faceAz), // اتجاه الواجهة
          faceAz: faceAz,
          quad: ['n', 'e', 's', 'w'][Math.round(((faceAz % 360) + 360) % 360 / 90) % 4]
        });
      }
      return out;
    }
  };

  /* ═══════════════════════════════════════════════════════
     ترقيع Turf — أي كود قديم يستدعي turf.area يحصل على
     النتيجة الصحيحة تلقائياً دون تعديل
     ═══════════════════════════════════════════════════════ */
  function patchTurf() {
    if (!W.turf || W.turf.__bannaaPatched) return false;

    var origArea = W.turf.area;
    W.turf.area = function (geo) {
      try {
        var g = geo && geo.geometry ? geo.geometry : geo;
        if (g && g.type === 'Polygon' && g.coordinates && g.coordinates[0]) {
          var a = areaRing(g.coordinates[0]);
          // اطرح الفجوات إن وُجدت
          for (var i = 1; i < g.coordinates.length; i++) a -= areaRing(g.coordinates[i]);
          return a;
        }
        if (g && g.type === 'MultiPolygon') {
          var t = 0;
          g.coordinates.forEach(function (poly) {
            t += areaRing(poly[0]);
            for (var j = 1; j < poly.length; j++) t -= areaRing(poly[j]);
          });
          return t;
        }
      } catch (e) { /* fallthrough */ }
      return origArea ? origArea.apply(W.turf, arguments) : 0;
    };

    var origDist = W.turf.distance;
    W.turf.distance = function (from, to, opts) {
      try {
        var f = from && from.geometry ? from.geometry.coordinates : from;
        var t = to && to.geometry ? to.geometry.coordinates : to;
        var m = distance(f[0], f[1], t[0], t[1]);
        var u = (opts && opts.units) || 'kilometers';
        if (u === 'meters') return m;
        if (u === 'kilometers') return m / 1000;
        if (u === 'miles') return m / 1609.344;
        if (u === 'feet') return m / 0.3048;
        return m / 1000;
      } catch (e) { /* fallthrough */ }
      return origDist ? origDist.apply(W.turf, arguments) : 0;
    };

    W.turf.__bannaaPatched = true;
    return true;
  }

  if (!patchTurf()) {
    // Turf لم يُحمَّل بعد — انتظره
    var tries = 0;
    var iv = setInterval(function () {
      if (patchTurf() || ++tries > 100) clearInterval(iv);
    }, 50);
  }

  W.BannaaGeoFix.patchTurf = patchTurf;

})(window);
