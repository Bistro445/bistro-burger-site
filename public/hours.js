"use strict";
// Horaires d'ouverture : logique commune au site public, à l'admin et au serveur
// (données structurées Google). Les horaires viennent de la clé "horaires" de
// site_content ; à défaut, les valeurs ci-dessous s'appliquent.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBHours = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  var DAYS_ABBR = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  var DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  var DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var DEFAULTS = {
    lundi: [["09:00", "14:00"]],
    mardi: [["09:00", "14:00"], ["17:30", "21:30"]],
    mercredi: [["09:00", "14:00"], ["17:30", "21:30"]],
    jeudi: [["09:00", "14:00"], ["17:30", "21:30"]],
    vendredi: [["09:00", "14:00"], ["17:30", "21:30"]],
    samedi: [],
    dimanche: [],
  };

  function toMinutes(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  function cloneRanges(r) {
    return r.map(function (x) { return [x[0], x[1]]; });
  }

  // Renvoie toujours 7 jours valides : toute plage incorrecte est ignorée,
  // et un jour absent reprend sa valeur par défaut.
  function normalize(input) {
    var src = input && input.days && typeof input.days === "object" ? input.days : null;
    var out = { days: {} };
    DAYS.forEach(function (d) {
      if (!src || !Array.isArray(src[d])) {
        out.days[d] = cloneRanges(DEFAULTS[d]);
        return;
      }
      var ranges = [];
      src[d].slice(0, 2).forEach(function (r) {
        if (!Array.isArray(r)) return;
        var a = toMinutes(r[0]), b = toMinutes(r[1]);
        if (a === null || b === null || a >= b) return;
        ranges.push([pad(r[0]), pad(r[1])]);
      });
      ranges.sort(function (x, y) { return toMinutes(x[0]) - toMinutes(y[0]); });
      out.days[d] = ranges;
    });
    return out;
  }

  function pad(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return (m[1].length === 1 ? "0" : "") + m[1] + ":" + m[2];
  }

  function fmtLong(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return Number(m[1]) + "h" + m[2];
  }
  function fmtShort(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return Number(m[1]) + "h" + (m[2] === "00" ? "" : m[2]);
  }

  function key(ranges) {
    return ranges.map(function (r) { return r[0] + "-" + r[1]; }).join("|");
  }

  // Regroupe les jours consécutifs ayant les mêmes plages. Renvoie
  // [{ from, to, ranges }] avec from/to = indices 0..6 (lundi..dimanche).
  function groups(h) {
    var res = [];
    DAYS.forEach(function (d, i) {
      var r = h.days[d];
      var last = res[res.length - 1];
      if (last && key(last.ranges) === key(r)) last.to = i;
      else res.push({ from: i, to: i, ranges: r });
    });
    return res;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function listFr(names) {
    if (names.length <= 1) return names.join("");
    return names.slice(0, -1).join(", ") + " et " + names[names.length - 1];
  }

  function dayRangeLabel(g) {
    if (g.from === g.to) return cap(DAYS[g.from]);
    if (g.to === g.from + 1) return cap(DAYS[g.from]) + " et " + DAYS[g.to];
    return "Du " + DAYS[g.from] + " au " + DAYS[g.to];
  }

  function rangesLong(ranges) {
    return ranges.map(function (r) { return fmtLong(r[0]) + "–" + fmtLong(r[1]); }).join(" et ");
  }
  function rangesShort(ranges) {
    return ranges.map(function (r) { return fmtShort(r[0]) + "–" + fmtShort(r[1]); }).join(" et ");
  }

  function closedDays(h) {
    var out = [];
    DAYS.forEach(function (d, i) { if (!h.days[d].length) out.push(i); });
    return out;
  }

  // Lignes complètes pour le bloc contact / la liste d'horaires.
  function longLines(h) {
    var lines = [];
    groups(h).forEach(function (g) {
      if (g.ranges.length) lines.push(dayRangeLabel(g) + " · " + rangesLong(g.ranges));
    });
    var closed = closedDays(h);
    if (closed.length === 7) return ["Fermé toute la semaine"];
    if (closed.length) lines.push("Fermé le " + listFr(closed.map(function (i) { return DAYS[i]; })).replace(/ et /g, " et le "));
    return lines;
  }

  // Lignes abrégées pour le pied de page.
  function shortLines(h) {
    var lines = [];
    groups(h).forEach(function (g) {
      if (!g.ranges.length) return;
      var label = g.from === g.to ? DAYS_SHORT[g.from]
        : g.to === g.from + 1 ? DAYS_SHORT[g.from] + " et " + DAYS_SHORT[g.to].toLowerCase()
        : DAYS_SHORT[g.from] + "–" + DAYS_SHORT[g.to];
      lines.push(label + " · " + rangesShort(g.ranges));
    });
    var closed = closedDays(h);
    if (closed.length === 7) return ["Fermé toute la semaine"];
    if (closed.length) lines.push("Fermé " + listFr(closed.map(function (i) { return DAYS_ABBR[i]; })));
    return lines;
  }

  function faqText(h) {
    var parts = [];
    groups(h).forEach(function (g) {
      if (!g.ranges.length) return;
      var label = g.from === g.to ? "Le " + DAYS[g.from]
        : g.to === g.from + 1 ? "Le " + DAYS[g.from] + " et le " + DAYS[g.to]
        : "Du " + DAYS[g.from] + " au " + DAYS[g.to];
      parts.push(label + ", de " + g.ranges.map(function (r) { return fmtLong(r[0]) + " à " + fmtLong(r[1]); }).join(" et de ") + ".");
    });
    var closed = closedDays(h);
    if (closed.length === 7) return "Le restaurant est actuellement fermé.";
    if (closed.length) parts.push("Nous sommes fermés " + listFr(closed.map(function (i) { return "le " + DAYS[i]; })) + ".");
    return parts.join(" ");
  }

  // Données structurées schema.org (OpeningHoursSpecification) pour Google.
  function schemaSpecs(h) {
    var byRange = {};
    var order = [];
    DAYS.forEach(function (d, i) {
      h.days[d].forEach(function (r) {
        var k = r[0] + "-" + r[1];
        if (!byRange[k]) { byRange[k] = { opens: r[0], closes: r[1], days: [] }; order.push(k); }
        byRange[k].days.push(DAYS_EN[i]);
      });
    });
    return order.map(function (k) {
      var x = byRange[k];
      return { "@type": "OpeningHoursSpecification", dayOfWeek: x.days.length === 1 ? x.days[0] : x.days, opens: x.opens, closes: x.closes };
    });
  }

  // Un créneau de réservation est proposé s'il tombe dans une plage d'ouverture
  // (au plus tard à la fermeture). dayJs : 0 = dimanche … 6 = samedi.
  function isOpenSlot(h, dayJs, minutes) {
    var d = DAYS[(dayJs + 6) % 7];
    return h.days[d].some(function (r) { return minutes >= toMinutes(r[0]) && minutes < toMinutes(r[1]); });
  }

  return {
    DAYS: DAYS, DEFAULTS: DEFAULTS,
    normalize: normalize, longLines: longLines, shortLines: shortLines,
    faqText: faqText, schemaSpecs: schemaSpecs, isOpenSlot: isOpenSlot, toMinutes: toMinutes,
  };
});
