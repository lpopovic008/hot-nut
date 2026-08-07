import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import hotNutLogo from "./assets/hot-nut-logo.png";

/* ───────────────────────────── palette ─────────────────────────────
   Box-score / stat-sheet identity. Cool newsprint paper, ink-black
   tabular numerals, hairline rules like a ruled scorecard. Signature:
   a literal highlighter swipe behind every game that matches a trend. */
const C = {
  paper:"#E2E5EA", card:"#F8F9FA", ink:"#14181F", inkSoft:"#525A66",
  rule:"#CDD3DA", ruleDark:"#9AA3AD", marker:"#FFE94D", markerDeep:"#F4CE2A",
  over:"#1B7F5C", under:"#D7263D", blue:"#2B4C7E",
  softOver:"rgba(27,127,92,0.32)", softUnder:"rgba(215,38,61,0.30)",
  softEven:"rgba(59,130,246,0.28)",
  /* soft violet — marks a hitter who once played a season alongside the
     starter he is facing today (see loadTeammateMarks) */
  softRevenge:"rgba(139,92,246,0.32)",
  /* today's-slate dark cells — light text/outline equivalents of ink/inkSoft/
     ruleDark/rule, used only when a card sits on the dark charcoal/navy pair */
  darkText:"#F2F4F7", darkTextSoft:"#AEB7C4", darkOutline:"#57616F", darkBorder:"#3A4250",
  // same green/red highlights, tuned brighter so a translucent tint still
  // pops against a dark charcoal/navy card instead of reading muddy; the
  // "wash" state is a soft blue glow instead of grey, so it reads as a
  // highlight rather than another shade of grey against the dark card
  darkSoftOver:"rgba(46,204,146,0.4)", darkSoftUnder:"rgba(255,107,117,0.38)",
  darkSoftEven:"rgba(96,165,250,0.4)",
  /* indicator colors — a neon graffiti set, ordered so each swatch sits
     next to its nearest hue on the color wheel */
  boom:"#FF073A",          /* neon red: hot bats, 10+ hits last game */
  slump:"#0FF0FC",         /* neon cyan: cold bats, 6 or fewer hits last game */
  rematch:"#16A2DF",       /* neon blue: chess-move pitcher */
  rematchLight:"#A9E1F7",  /* light neon blue: faced but short outing */
  travel:"#FF073A",        /* neon red: jet-lagged west→east */
  late:"#39FF14",          /* neon green: clutch late-night drama */
  bigday:"#F4289B",        /* neon pink: 10-run scoreboard explosion */
  echo:"#FF8C1A",          /* neon orange: momentum wave */
  gauntlet:"#0FF0FC",      /* neon cyan: a brutal stretch of ace pitching, just survived */
  revenge:"#8B5CF6",       /* neon violet: pitcher facing a team he used to play for */
  shutout:"#1F51FF",       /* neon blue: got blanked, 0 runs last game — shares the Big
                               Day box (opposite extreme, same slot) rather than its own */
  duel:"#F2FF00",          /* neon yellow: both of tonight's starters are on their third-or-
                               later look at the lineup across from them. Not a trend-box
                               slot — it outlines both ERA numbers at once (see StatsAndTrends) */
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const API = "https://statsapi.mlb.com/api/v1";
const SEASON = new Date().getFullYear();

// Global notes via JSONBin.io — free, allows browser reads + writes.
// SETUP: step 1 — jsonbin.io → sign up → API Keys → copy your Access Key
//           with Read + Update enabled. step 2 — Create Bin with contents {"text":""},
//           copy the Bin ID from its URL.
// Paste both below. Leave NOTES_BIN empty to keep notes per-device only.
const NOTES_BIN = "6a43cd2bf5f4af5e2947d66d";   // e.g. 65a1b2c3dc74654018abcd12
const NOTES_KEY = "$2a$10$EzB/eCQ9ZvPSCyKLss3TxO/fUj0dDmaDEvWEphLhD6eQ7ivrryUVG";   // your JSONBin Access Key, sent as X-Access-Key
const NOTES_URL = NOTES_BIN ? `https://api.jsonbin.io/v3/b/${NOTES_BIN}` : "";

/* MLB home-park time zones for travel detection */
const TEAM_TZ = {
  108:"PT",109:"MT",110:"ET",111:"ET",112:"CT",113:"ET",114:"ET",115:"MT",
  116:"ET",117:"CT",118:"CT",119:"PT",120:"ET",121:"ET",133:"PT",134:"ET",
  135:"PT",136:"PT",137:"PT",138:"CT",139:"ET",140:"CT",141:"ET",142:"CT",
  143:"ET",144:"ET",145:"CT",146:"ET",147:"ET",158:"CT",
};
const TZ_RANK = { PT:0, MT:1, CT:2, ET:3 };
/* TEMPORARY — supports the extras-then-matinee test indicator below; remove
   with it. Offsets are the daylight-saving ones, which hold for every date in
   the regular season. Arizona keeps standard time year round and so runs an
   hour off here, which is close enough for judging "night game" vs "day game". */
const TZ_UTC_OFFSET = { ET:-4, CT:-5, MT:-6, PT:-7 };
const localStartHour = (iso, tz) => {
  const off = TZ_UTC_OFFSET[tz];
  if (off==null || !iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : (d.getUTCHours() + off + 24) % 24;
};
const TEAM_ABBR = {
  108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",115:"COL",
  116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",133:"ATH",134:"PIT",
  135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",140:"TEX",141:"TOR",142:"MIN",
  143:"PHI",144:"ATL",145:"CWS",146:"MIA",147:"NYY",158:"MIL",
};
const TEAM_NAME = {
  108:"Angels",109:"Diamondbacks",110:"Orioles",111:"Red Sox",112:"Cubs",113:"Reds",
  114:"Guardians",115:"Rockies",116:"Tigers",117:"Astros",118:"Royals",119:"Dodgers",
  120:"Nationals",121:"Mets",133:"Athletics",134:"Pirates",135:"Padres",136:"Mariners",
  137:"Giants",138:"Cardinals",139:"Rays",140:"Rangers",141:"Blue Jays",142:"Twins",
  143:"Phillies",144:"Braves",145:"White Sox",146:"Marlins",147:"Yankees",158:"Brewers",
};
const HIT_STATS = [
  ["hits","Hits"],["totalBases","Total Bases"],["homeRuns","Home Runs"],
  ["rbi","RBIs"],["runs","Runs"],["baseOnBalls","Walks"],
  ["strikeOuts","Strikeouts"],["stolenBases","Stolen Bases"],
  ["doubles","Doubles"],["hits+runs+rbi","Hits+Runs+RBI"],
];

const todayISO = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
};
const addDays = (iso,n) => {
  const d = new Date(iso+"T00:00:00"); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
};
const prettyDay = (iso) =>
  new Date(iso+"T00:00:00").toLocaleDateString(undefined,
    { weekday:"short", month:"short", day:"numeric" });
const calDay = (iso) => {
  const d = new Date(iso+"T00:00:00");
  return { wd: d.toLocaleDateString(undefined,{weekday:"short"}),
    md: `${d.getMonth()+1}/${d.getDate()}` };
};

const valOf = (stat,key) =>
  key.split("+").reduce((s,k)=>s+(Number(stat[k])||0),0);

/* throttled async map so we don't fire hundreds of calls at once */
async function mapPool(items, n, fn) {
  const res = []; let i = 0;
  const workers = Array.from({length:Math.min(n,items.length)}, async () => {
    while (i < items.length) { const idx = i++; res[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers); return res;
}
const isNet = (m) => /Failed to fetch|NetworkError/i.test(m);
// MLB innings-pitched is reported in tenths standing for thirds ("6.1" =
// 6 innings + 1 out, "6.2" = +2 outs) — convert to a plain out count so
// workloads can be compared precisely instead of as a fake decimal.
const ipToOuts = (ip) => {
  const v = parseFloat(ip) || 0;
  const whole = Math.floor(v), frac = Math.round((v-whole)*10);
  return whole*3 + frac;
};

/* ══════════════════ SDQL — Sports Data Query Language ══════════════════
   A replica of Killersports' SDQL over MLB Stats API data. A query is a
   chain of phrases joined by `and`/`or`, where each phrase compares a
   parameter to a value:  runs>5 and site=home and p:runs<3

   The unit of a result is a TEAM-GAME, not a game, so every game in the
   season produces two rows — one from each team's point of view. That is
   what makes `o:` (the opponent's row) and plain `runs` mean different
   things in the same query.

   Parameters can be pointed at a different row with a prefix chain, read
   left to right:  o: = the opponent's row in the same game, p: = this
   team's previous game, n: = its next game, s: = the starting pitcher's
   own previous start, t: = this row (a no-op, for symmetry). They combine
   without restriction, so p:o:runs is "runs the opponent scored in this
   team's last game" and o:p:runs is "runs the opponent scored in THEIR
   last game".

   Built from the published SDQL grammar; betting parameters (line, total,
   moneyline and the F/D/O/U shortcuts) are deliberately absent because the
   free MLB Stats API carries no market data — they parse, then report why
   rather than silently returning nothing. */

class SdqlError extends Error {}

// one team's view of one finished game. Both rows of a game share a gamePk
// and point at each other through _opp, which is what `o:` walks.
function buildSdqlRows(games) {
  const rows = [];
  games.forEach(g => {
    if (g.status?.abstractGameState !== "Final") return;
    const ls = g.linescore || {};
    const date = g.officialDate || (g.gameDate||"").slice(0,10);
    if (!date) return;
    const side = (which) => {
      const t = g.teams?.[which] || {};
      return {
        name: t.team?.name || "—", id: t.team?.id ?? null, score: t.score,
        hits: ls.teams?.[which]?.hits ?? null,
        errors: ls.teams?.[which]?.errors ?? null,
        starter: t.probablePitcher?.fullName || null,
        starterId: t.probablePitcher?.id ?? null,
      };
    };
    const home = side("home"), away = side("away");
    if (home.score==null || away.score==null) return;   // postponed / no result
    const innings = ls.innings || [];
    const mk = (me, opp, siteName, key) => ({
      gamePk: g.gamePk, date, dateNum: Number(date.replace(/-/g,"")),
      season: Number(date.slice(0,4)), month: Number(date.slice(5,7)), day: Number(date.slice(8,10)),
      dow: new Date(`${date}T12:00:00`).getDay(),
      team: me.name, teamId: me.id, oTeam: opp.name, oTeamId: opp.id,
      site: siteName, runs: me.score, hits: me.hits, errors: me.errors,
      // the park this was played in, as a timezone rank — lets a query say
      // "was out west last night, back east tonight" without leaving SDQL
      tz: TZ_RANK[TEAM_TZ[siteName==="home" ? me.id : opp.id]] ?? null,
      starter: me.starter, starterId: me.starterId,
      // key each frame off its own `num` rather than its position in the
      // array: a linescore that skips or reorders a frame would otherwise
      // slide every later inning down one and quietly misreport inning8
      innings: innings.reduce((acc,fr) => {
        if (fr?.num >= 1) acc[fr.num-1] = fr[key]?.runs ?? 0;
        return acc;
      }, []),
      margin: me.score - opp.score,
      win: me.score > opp.score ? 1 : 0,
      loss: me.score < opp.score ? 1 : 0,
      rest: null, streak: 0, smeetings: null,
      _opp: null, _prev: null, _next: null, _sprev: null,
    });
    rows.push(mk(home, away, "home", "home"));
    rows.push(mk(away, home, "away", "away"));
  });

  rows.sort((a,b) => a.dateNum-b.dateNum || a.gamePk-b.gamePk
    || a.site.localeCompare(b.site));

  // pair the two rows of each game together
  const byGame = new Map();
  rows.forEach((r,i) => {
    const pair = byGame.get(r.gamePk);
    if (pair==null) byGame.set(r.gamePk, i);
    else { rows[i]._opp = pair; rows[pair]._opp = i; }
  });

  // Chronological chain per team, which also yields rest days and the win/loss
  // streak the team carried INTO each game (not out of it).
  //
  // Every chain below is keyed by team-and-SEASON, not team alone. With more
  // than one season loaded, a continuous chain would make Opening Day's `p:`
  // point at last October's finale — five months and a roster overhaul later —
  // and hand it a `rest` of ~150 days. Each season starts clean instead.
  const byTeam = new Map();
  rows.forEach((r,i) => {
    if (r.teamId==null) return;
    const key = `${r.teamId}|${r.season}`;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(i);
  });
  byTeam.forEach(idxs => {
    let streak = 0;
    idxs.forEach((i,n) => {
      const r = rows[i];
      r.streak = streak;
      if (n>0) {
        const prev = rows[idxs[n-1]];
        r._prev = idxs[n-1];
        prev._next = i;
        // days off between games; the back half of a doubleheader is 0, not -1
        r.rest = Math.max(0, Math.round(
          (new Date(`${r.date}T12:00:00`) - new Date(`${prev.date}T12:00:00`))
          / 86400000) - 1);
      }
      streak = r.win ? (streak>0 ? streak+1 : 1) : r.loss ? (streak<0 ? streak-1 : -1) : streak;
    });
  });

  // the starter's own previous start, which is what MLB's s: prefix walks
  const byStarter = new Map();
  rows.forEach((r,i) => {
    if (r.starterId==null) return;
    const key = `${r.starterId}|${r.season}`;
    const prev = byStarter.get(key);
    if (prev!=null) r._sprev = prev;
    byStarter.set(key, i);
  });

  // how many times this starter has ALREADY faced tonight's opponent this
  // season. Counting meetings rather than walking s: back through the start
  // sequence is the whole point: a pitcher's three turns against one club are
  // usually spread across other opponents, so consecutive-start chains miss
  // them. smeetings=2 means this is his third time out against this lineup.
  const meetings = new Map();
  rows.forEach(r => {
    if (r.starterId==null || r.oTeamId==null) return;
    const key = `${r.starterId}|${r.oTeamId}|${r.season}`;
    const seen = meetings.get(key) || 0;
    r.smeetings = seen;
    meetings.set(key, seen+1);
  });

  return rows;
}

// A season arrives as one fetch per month rather than one for the whole year:
// the responses stay small enough to be reliable, and the months run together
// instead of in a queue. Raw games are cached per season — widening a range
// only pays for the years that weren't already loaded.
const SDQL_SPANS = [[3,1,3,31],[4,1,4,30],[5,1,5,31],[6,1,6,30],
  [7,1,7,31],[8,1,8,31],[9,1,9,30],[10,1,10,31]];
const SDQL_FIRST_SEASON = 2000;   // linescore detail is dependable from here on
const sdqlGamesBySeason = {};     // year -> Promise<game[]>
function loadSdqlGames(year) {
  if (!sdqlGamesBySeason[year]) {
    sdqlGamesBySeason[year] = (async () => {
      const pad = (n) => String(n).padStart(2,"0");
      const chunks = await mapPool(SDQL_SPANS, 4, async ([m1,d1,m2,d2]) => {
        const r = await fetch(`${API}/schedule?sportId=1&gameType=R` +
          `&startDate=${year}-${pad(m1)}-${pad(d1)}&endDate=${year}-${pad(m2)}-${pad(d2)}` +
          `&hydrate=linescore,probablePitcher`);
        if (!r.ok) throw new Error(`schedule ${r.status}`);
        const j = await r.json();
        const out = [];
        (j.dates||[]).forEach(d => (d.games||[]).forEach(g => out.push(g)));
        return out;
      });
      return chunks.flat();
    })();
    // a failed year must not poison every later attempt
    sdqlGamesBySeason[year].catch(() => { delete sdqlGamesBySeason[year]; });
  }
  return sdqlGamesBySeason[year];
}

// Rows for a whole span of seasons, memoized on the span itself so re-running
// a query against the same years is instant. Two seasons load at a time: any
// more and the browser's own connection limit just queues them anyway.
let sdqlRowsCache = { key:null, rows:null };
async function loadSdqlSeasons(from, to, onProgress) {
  const years = [];
  for (let y=Math.min(from,to); y<=Math.max(from,to); y++) years.push(y);
  const key = years.join(",");
  if (sdqlRowsCache.key === key) return sdqlRowsCache.rows;
  let done = 0;
  onProgress?.(0, years.length);
  const perYear = await mapPool(years, 2, async (y) => {
    const games = await loadSdqlGames(y);
    onProgress?.(++done, years.length);
    return games;
  });
  const rows = buildSdqlRows(perYear.flat());
  sdqlRowsCache = { key, rows };
  return rows;
}

/* ── the parameter vocabulary ───────────────────────────────────────── */
const SDQL_PARAMS = {
  runs:     { type:"num", get:r=>r.runs,     desc:"runs scored by the team" },
  hits:     { type:"num", get:r=>r.hits,     desc:"team hits" },
  errors:   { type:"num", get:r=>r.errors,   desc:"team errors" },
  margin:   { type:"num", get:r=>r.margin,   desc:"runs scored minus runs allowed" },
  win:      { type:"num", get:r=>r.win,      desc:"1 on a win, 0 otherwise" },
  loss:     { type:"num", get:r=>r.loss,     desc:"1 on a loss, 0 otherwise" },
  streak:   { type:"num", get:r=>r.streak,   desc:"W/L streak carried into the game (+3 = won last 3)" },
  rest:     { type:"num", get:r=>r.rest,     desc:"days off before the game (0 = played yesterday)" },
  date:     { type:"num", get:r=>r.dateNum,  desc:"game date as YYYYMMDD" },
  season:   { type:"num", get:r=>r.season,   desc:"season year" },
  month:    { type:"num", get:r=>r.month,    desc:"month, 3–10" },
  day:      { type:"num", get:r=>r.day,      desc:"day of the month" },
  dow:      { type:"num", get:r=>r.dow,      desc:"day of week, 0 = Sunday" },
  team:     { type:"str", get:r=>r.team,     desc:"team name" },
  opponent: { type:"str", get:r=>r.oTeam,    desc:"opponent name" },
  site:     { type:"str", get:r=>r.site,     desc:"'home' or 'away'" },
  tz:       { type:"num", get:r=>r.tz,       desc:"venue time zone: 0 Pacific, 1 Mountain, 2 Central, 3 Eastern" },
  starter:  { type:"str", get:r=>r.starter,  desc:"probable/actual starting pitcher" },
  smeetings:{ type:"num", get:r=>r.smeetings,
    desc:"starts this pitcher has already made against tonight's opponent this season — 2 means this is his third" },
};
for (let i=1; i<=9; i++) {
  SDQL_PARAMS[`inning${i}`] = { type:"num", get:r=>r.innings[i-1] ?? 0,
    desc:`runs scored in inning ${i}` };
  // The running score, so "trailing after seven" is total7<o:total7 rather
  // than a seven-term sum on each side of the comparison. Summed with an
  // explicit loop because the innings array is keyed by frame number and can
  // legitimately have holes in it.
  SDQL_PARAMS[`total${i}`] = { type:"num",
    get:r => { let s = 0; for (let k=0; k<i; k++) s += r.innings[k] || 0; return s; },
    desc:`runs scored through inning ${i} (running total)` };
}
// present in real SDQL, absent here — named explicitly so a query using one
// gets a reason instead of a bare "unknown parameter".
const SDQL_NO_MARKET = {
  line:"the pointspread/run line", total:"the betting total",
  moneyline:"the moneyline", ou:"the over/under result",
};
const SDQL_SHORTCUTS = {
  H:{ param:"site", eq:"home" }, A:{ param:"site", eq:"away" },
  W:{ param:"win",  eq:1 },      L:{ param:"loss", eq:1 },
};
const SDQL_NO_MARKET_SHORTCUTS = { F:"favorite", D:"underdog", O:"over", U:"under" };
const SDQL_PREFIXES = {
  o:"the opponent's row in the same game",
  p:"this team's previous game",
  n:"this team's next game",
  s:"the starting pitcher's previous start",
  t:"this row (no-op)",
};

/* ── tokenizer ──────────────────────────────────────────────────────── */
function sdqlTokenize(src) {
  const out = [];
  const ops = [">=","<=","!=","<>","==","=",">","<","+","-","*","/","(",")",",","@",":"];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i+1);
      if (end < 0) throw new SdqlError(`unterminated string starting at position ${i+1}`);
      out.push({ t:"str", v:src.slice(i+1,end) }); i = end+1; continue;
    }
    if (/[0-9]/.test(c) || (c==="." && /[0-9]/.test(src[i+1]||""))) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      out.push({ t:"num", v:Number(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      out.push({ t:"word", v:m[0] }); i += m[0].length; continue;
    }
    const op = ops.find(o => src.startsWith(o, i));
    if (!op) throw new SdqlError(`unexpected character "${c}" at position ${i+1}`);
    out.push({ t:"op", v: op==="<>" ? "!=" : op==="==" ? "=" : op }); i += op.length;
  }
  out.push({ t:"end", v:null });
  return out;
}

/* ── parser ─────────────────────────────────────────────────────────────
   precedence, loosest first: or → and → not → comparison → +/- → *,/ */
function sdqlParse(src) {
  const toks = sdqlTokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v) => peek().t==="op" && peek().v===v;
  const isWord = (v) => peek().t==="word" && peek().v.toLowerCase()===v;
  const eat = () => toks[pos++];
  const expect = (v) => { if (!isOp(v)) throw new SdqlError(`expected "${v}"`); return eat(); };

  function parseOr() {
    let l = parseAnd();
    while (isWord("or")) { eat(); l = { k:"or", l, r:parseAnd() }; }
    return l;
  }
  function parseAnd() {
    let l = parseNot();
    while (isWord("and")) { eat(); l = { k:"and", l, r:parseNot() }; }
    return l;
  }
  function parseNot() {
    if (isWord("not")) { eat(); return { k:"not", x:parseNot() }; }
    return parseCmp();
  }
  function parseCmp() {
    let l = parseAdd();
    for (;;) {
      const cmp = ["=","!=",">","<",">=","<="].find(o => isOp(o));
      if (cmp) { eat(); l = { k:"cmp", op:cmp, l, r:parseAdd() }; continue; }
      if (isWord("in")) { eat(); l = { k:"in", l, r:parseAdd() }; continue; }
      return l;
    }
  }
  function parseAdd() {
    let l = parseMul();
    while (isOp("+") || isOp("-")) { const op = eat().v; l = { k:"bin", op, l, r:parseMul() }; }
    return l;
  }
  function parseMul() {
    let l = parseUnary();
    while (isOp("*") || isOp("/")) { const op = eat().v; l = { k:"bin", op, l, r:parseUnary() }; }
    return l;
  }
  function parseUnary() {
    if (isOp("-")) { eat(); return { k:"neg", x:parseUnary() }; }
    return parsePrimary();
  }
  function parsePrimary() {
    const tk = peek();
    if (tk.t==="num") { eat(); return { k:"lit", v:tk.v }; }
    if (tk.t==="str") { eat(); return { k:"lit", v:tk.v }; }
    if (isOp("(")) {
      eat();
      const first = parseOr();
      if (isOp(",")) {                     // a list, for the `in` operator
        const items = [first];
        while (isOp(",")) { eat(); items.push(parseOr()); }
        expect(")");
        return { k:"list", items };
      }
      expect(")");
      return first;
    }
    if (tk.t==="word") {
      const prefixes = [];
      let word = eat().v;
      while (isOp(":")) { eat();
        prefixes.push(word.toLowerCase());
        if (peek().t!=="word") throw new SdqlError(`expected a parameter after "${word}:"`);
        word = eat().v;
      }
      return { k:"param", prefixes, name:word };
    }
    throw new SdqlError("unexpected end of query");
  }

  const where = parseOr();
  let groupBy = [];
  if (isOp("@")) {
    eat();
    for (;;) {
      if (peek().t!=="word") throw new SdqlError("expected a parameter to group by after @");
      groupBy.push(eat().v.toLowerCase());
      if (isOp(",")) { eat(); continue; }
      break;
    }
  }
  if (peek().t!=="end") throw new SdqlError(`unexpected "${peek().v}" after the end of the query`);
  return { where, groupBy };
}

/* ── evaluator ──────────────────────────────────────────────────────── */
// walk a prefix chain left to right; returns null when the chain runs off
// the end of a team's season (no previous game, no next game, …).
function sdqlHop(rows, idx, prefixes) {
  let cur = idx;
  for (const p of prefixes) {
    if (cur==null) return null;
    const r = rows[cur];
    if (p==="o") cur = r._opp;
    else if (p==="p") cur = r._prev;
    else if (p==="n") cur = r._next;
    else if (p==="s") cur = r._sprev;
    else if (p==="t") { /* this row */ }
    else throw new SdqlError(`unknown prefix "${p}:" — try ${Object.keys(SDQL_PREFIXES).map(x=>x+":").join(", ")}`);
    if (cur===undefined) cur = null;
  }
  return cur;
}

const sdqlTruthy = (v) => v===true || (typeof v==="number" && v!==0);

function sdqlEvalNode(node, rows, idx) {
  switch (node.k) {
    case "lit": return node.v;
    case "list": return node.items.map(n => sdqlEvalNode(n, rows, idx));
    case "neg": {
      const v = sdqlEvalNode(node.x, rows, idx);
      return v==null ? null : -v;
    }
    case "and": return sdqlTruthy(sdqlEvalNode(node.l, rows, idx))
      && sdqlTruthy(sdqlEvalNode(node.r, rows, idx));
    case "or": return sdqlTruthy(sdqlEvalNode(node.l, rows, idx))
      || sdqlTruthy(sdqlEvalNode(node.r, rows, idx));
    case "not": return !sdqlTruthy(sdqlEvalNode(node.x, rows, idx));
    case "bin": {
      const a = sdqlEvalNode(node.l, rows, idx), b = sdqlEvalNode(node.r, rows, idx);
      if (a==null || b==null) return null;
      if (node.op==="+" && (typeof a==="string" || typeof b==="string")) return `${a}${b}`;
      const x = Number(a), y = Number(b);
      if (Number.isNaN(x) || Number.isNaN(y)) return null;
      return node.op==="+" ? x+y : node.op==="-" ? x-y
        : node.op==="*" ? x*y : (y===0 ? null : x/y);
    }
    case "in": {
      const a = sdqlEvalNode(node.l, rows, idx);
      const list = sdqlEvalNode(node.r, rows, idx);
      if (a==null) return false;
      return (Array.isArray(list) ? list : [list])
        .some(v => sdqlCompare("=", a, v, node));
    }
    case "cmp": {
      const a = sdqlEvalNode(node.l, rows, idx), b = sdqlEvalNode(node.r, rows, idx);
      return sdqlCompare(node.op, a, b, node);
    }
    case "param": {
      const key = node.name.toLowerCase();
      // shortcuts take a prefix chain like any other parameter, so p:W is
      // "won the previous game" and o:H is "the opponent was at home"
      if (SDQL_SHORTCUTS[node.name]) {
        const sc = SDQL_SHORTCUTS[node.name];
        const target = sdqlHop(rows, idx, node.prefixes);
        if (target==null) return null;
        const v = SDQL_PARAMS[sc.param].get(rows[target]);
        return v===sc.eq ? 1 : 0;
      }
      if (SDQL_NO_MARKET_SHORTCUTS[node.name])
        throw new SdqlError(`"${node.name}" needs betting-market data (${SDQL_NO_MARKET_SHORTCUTS[node.name]}), ` +
          `which the free MLB Stats API doesn't carry.`);
      if (SDQL_NO_MARKET[key])
        throw new SdqlError(`"${key}" is ${SDQL_NO_MARKET[key]} — the free MLB Stats API carries no ` +
          `market data, so this parameter isn't available here.`);
      const spec = SDQL_PARAMS[key];
      if (!spec) {
        // a bare word that isn't a parameter is a string value, which is what
        // makes team=Yankees work without quotes
        if (!node.prefixes.length) return { _bare: node.name };
        throw new SdqlError(`unknown parameter "${node.name}"`);
      }
      const target = sdqlHop(rows, idx, node.prefixes);
      if (target==null) return null;
      const v = spec.get(rows[target]);
      return v==null ? null : v;
    }
    default: throw new SdqlError("could not evaluate the query");
  }
}

// bare words carry through as {_bare} so a typo compared against a number
// can be reported as an unknown parameter rather than silently never matching
function sdqlCompare(op, a, b, node) {
  const bareA = a && typeof a==="object" && "_bare" in a;
  const bareB = b && typeof b==="object" && "_bare" in b;
  if (bareA && typeof b==="number") throw new SdqlError(`unknown parameter "${a._bare}"`);
  if (bareB && typeof a==="number") throw new SdqlError(`unknown parameter "${b._bare}"`);
  const av = bareA ? a._bare : a, bv = bareB ? b._bare : b;
  if (av==null || bv==null) return false;   // a row the prefix chain can't reach never matches
  if (typeof av==="string" || typeof bv==="string") {
    const x = String(av).toLowerCase(), y = String(bv).toLowerCase();
    if (op==="=") return x===y;
    if (op==="!=") return x!==y;
    if (node) throw new SdqlError(`can't use "${op}" to compare text values`);
    return false;
  }
  switch (op) {
    case "=":  return av===bv;
    case "!=": return av!==bv;
    case ">":  return av>bv;
    case "<":  return av<bv;
    case ">=": return av>=bv;
    case "<=": return av<=bv;
    default:   return false;
  }
}

// run a parsed query over the season and summarize the team-games it matched
function sdqlRun(ast, rows) {
  const matched = [];
  rows.forEach((r,i) => { if (sdqlTruthy(sdqlEvalNode(ast.where, rows, i))) matched.push(i); });
  const summarize = (idxs) => {
    const n = idxs.length;
    const sum = (fn) => idxs.reduce((s,i) => s + (Number(fn(rows[i]))||0), 0);
    const oppRuns = (i) => rows[i]._opp==null ? 0 : rows[rows[i]._opp].runs;
    return {
      games: n,
      wins: idxs.filter(i=>rows[i].win).length,
      losses: idxs.filter(i=>rows[i].loss).length,
      runs: n ? sum(r=>r.runs)/n : null,
      oRuns: n ? idxs.reduce((s,i)=>s+oppRuns(i),0)/n : null,
      combined: n ? idxs.reduce((s,i)=>s+rows[i].runs+oppRuns(i),0)/n : null,
      margin: n ? sum(r=>r.margin)/n : null,
    };
  };
  let groups = null;
  if (ast.groupBy.length) {
    const keyOf = (i) => ast.groupBy.map(g => {
      if (SDQL_PARAMS[g]) return String(SDQL_PARAMS[g].get(rows[i]) ?? "—");
      throw new SdqlError(`can't group by "${g}" — not a parameter`);
    }).join(" · ");
    const buckets = new Map();
    matched.forEach(i => {
      const k = keyOf(i);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });
    groups = [...buckets.entries()]
      .map(([key, idxs]) => ({ key, ...summarize(idxs) }))
      .sort((a,b) => b.games-a.games || a.key.localeCompare(b.key));
  }
  return {
    total: summarize(matched),
    groups,
    groupBy: ast.groupBy,
    rows: matched.slice().reverse().map(i => {
      const r = rows[i], o = r._opp==null ? null : rows[r._opp];
      return { date:r.date, team:r.team, site:r.site, oTeam:r.oTeam,
        runs:r.runs, oRuns:o?o.runs:null, win:r.win, loss:r.loss, starter:r.starter };
    }),
  };
}

// net offensive production in one game/stint: times on base (hits + walks)
// plus total bases (hits, with extra credit for doubles/triples/homers when
// present), LESS strikeouts. A punchout subtracts because it's the one out
// that advances nothing — no ball in play, no runner moved, no chance of a
// defensive mistake — so two teams with identical hit and walk totals are
// separated by how often they put the ball in play.
//
// The same OPS-flavored figure serves both the batting score (a team's own
// output) and the pitcher score (what a pitcher allowed), read from
// whichever side's stat line. Netting out strikeouts is the right direction
// for both: a pitcher's own K's reduce the production charged against him.
function combinedProduction(stat) {
  const h = Number(stat?.hits)||0, bb = Number(stat?.baseOnBalls)||0,
    k = Number(stat?.strikeOuts)||0;
  const doubles = Number(stat?.doubles)||0, triples = Number(stat?.triples)||0, hr = Number(stat?.homeRuns)||0;
  const totalBases = h + doubles + 2*triples + 3*hr;
  return (h+bb) + totalBases - k;
}
// same "combined production" concept, but as a rate — per 9 innings for a
// pitcher's own season line, or per team-game (treated as a stand-in for
// "per 9 innings faced") for a team's season hitting line. Must subtract the
// strikeout rate to match combinedProduction above, or every actual would be
// measured against an inflated expectation.
function combinedProduction9(rates) {
  return (rates.h9+rates.bb9)
    + (rates.h9 + rates.doubles9 + 2*rates.triples9 + 3*rates.hr9)
    - (rates.k9||0);
}
// roughly modern-MLB league-average rates, used only when a pitcher's or
// team's own season log isn't available yet.
const LEAGUE_AVG_RATES = { h9:8.7, bb9:3.1, hr9:1.2, doubles9:1.6, triples9:0.15, k9:8.6 };
// league-average production per nine — the anchor 5.0 sits on
const PROD_PAR9 = combinedProduction9(LEAGUE_AVG_RATES);
// roughly one standard deviation of team-game production, and the unit the
// score is denominated in. Judging by RATIO (the old 5 + 4.5*ln(actual/
// expected)) worked while par was ~26, but netting strikeouts out dropped it
// to ~17, small enough that an ordinary cold night divided out to near zero
// and pinned to the floor — so 0s and 10s crowded out the range between.
const PROD_SPREAD9 = 9;
// where 3.0 and 7.0 land, in spreads either side of par
const SCORE_EDGE = 0.8;
const SCORE_SLOPE = Math.log(7/3) / SCORE_EDGE;

// 5.0 is exactly par. The GAP between actual and expected production (not
// their ratio) is measured in spreads and run through a logistic curve, so
// the thresholds stay exactly where they were — a 0.8-spread shortfall reads
// 3.0, the same surplus reads 7.0 — while the ends merely approach 0 and 10
// instead of pinning to them: a brutal night lands near 1, a monster one near
// 9. Working on the gap also takes a negative `actual` in stride, which a
// log-ratio could not (strikeouts can push production below zero).
// `invert` flips which direction "doing well" means: a batter wants
// production above expectation, a pitcher wants to allow less than it.
function qualityScore(actual, expected, invert=false) {
  if (!(expected>0)) return null;
  // the spread grows with how much of a game is being judged, but sublinearly:
  // production is a sum of many small events, so its swing scales with the
  // square root of the innings behind it rather than with the innings
  const spread = PROD_SPREAD9 * Math.sqrt(expected / PROD_PAR9);
  const gap = invert ? expected-actual : actual-expected;
  const score = 10 / (1 + Math.exp(-SCORE_SLOPE * gap/spread));
  return Number.isFinite(score) ? score : null;
}
// season-average workload/rate context used to color an individual start:
// average outs per start, hits/walks per 9 innings, and ERA.
function pitcherSeasonAverages(splits) {
  if (!splits || !splits.length) return null;
  const sum = (k) => splits.reduce((s,g)=>s+(Number(g.stat?.[k])||0),0);
  const outs = splits.reduce((s,g)=>s+ipToOuts(g.stat?.inningsPitched), 0);
  if (!outs) return null;
  return {
    avgOuts: outs/splits.length,
    h9: sum("hits")*27/outs,
    bb9: sum("baseOnBalls")*27/outs,
    k9: sum("strikeOuts")*27/outs,
    era: sum("earnedRuns")*27/outs,
  };
}
// colors one pitcher start's IP/H/ER/BB/K line relative to the pitcher's own
// season pace (or fixed fallback thresholds if no season data exists yet).
// Shared by PLine's rendering and the pitcher-rematch verdict below, which
// votes on the H/BB/ER subset of these colors.
function pitcherLineColors(st, season, dark) {
  const col = (good, bad) => good ? C.over : bad ? C.under : (dark ? C.darkText : C.ink);
  const outs = ipToOuts(st.inningsPitched);
  const h = Number(st.hits)||0, er = Number(st.earnedRuns)||0;
  const bb = Number(st.baseOnBalls)||0, k = Number(st.strikeOuts)||0;

  const ipCol = season
    ? col(outs > season.avgOuts+3, outs < season.avgOuts-3)
    : col(outs>=18, outs>0 && outs<12);

  // H/ER/BB/K: below a 2.0-inning outing (6 outs) the rate stats are too
  // noisy to judge against fixed benchmarks, so short outings still color
  // relative to the pitcher's own season pace (or the flat fallback, if no
  // season data exists yet). Longer outings use fixed per-9 benchmarks —
  // league-average-ish rates read as "bad" here since the goal is calling
  // out starts that were actually good, not just average.
  const SHORT_OUTING_OUTS = 6;   // 2.0 innings
  const longOuting = outs > SHORT_OUTING_OUTS;
  const rate9 = (n) => outs>0 ? n*27/outs : null;

  let hCol, bbCol, erCol, kCol;
  if (season && longOuting) {
    const h9 = rate9(h), bb9 = rate9(bb), era = rate9(er), k9 = rate9(k);
    hCol  = col(h9<=7.0, h9>=9.0);
    bbCol = col(bb9<=2.0, bb9>=4.0);
    erCol = col(era<=3.0, era>=4.0);
    kCol  = col(k9>=9.0, k9<=6.0);
  } else {
    const expH = season ? season.h9 * outs/27 : null;
    hCol = expH!=null ? col(h<=expH-1.5, h>=expH+1.5) : col(h<=3, h>=5);
    const expBB = season ? season.bb9 * outs/27 : null;
    bbCol = expBB!=null ? col(bb<=expBB-1, bb>=expBB+1) : col(bb<=1, bb>=3);
    const gameERA = outs>0 ? er*27/outs : null;
    erCol = (gameERA!=null && season)
      ? col(gameERA<=season.era-1, gameERA>=season.era+1)
      : col(er<=1, er>3);
    const expK = season ? season.k9 * outs/27 : null;
    kCol = expK!=null ? col(k>=expK+2, k<=expK-2) : col(k>=5, k<=3);
  }
  return { ipCol, hCol, erCol, bbCol, kCol };
}
// How a pitcher's last outing against today's opponent graded, as one
// color-coded verdict for the ERA box. Only hits, walks and earned runs
// vote — those are
// the three that say whether the lineup actually got to him. Innings pitched
// is a usage decision more than a result, and strikeouts can stay high in a
// start that still got hit hard, so both are left out of the tally.
//
// Whichever color outnumbers the other wins outright: 2 green + 1 red reads
// green. A neutral stat abstains rather than voting for itself, so one green
// among two unremarkable stats still reads green. Green and red in equal
// measure — or three neutrals, with nothing to go on — reads blue.
function rematchVerdictFor(stat, season) {
  const { hCol, bbCol, erCol } = pitcherLineColors(stat, season);
  const trio = [hCol, bbCol, erCol];
  const greens = trio.filter(c => c===C.over).length;
  const reds   = trio.filter(c => c===C.under).length;
  return greens>reds ? "up" : reds>greens ? "down" : "even";
}
// tags may be an old plain string or the new { text, away, home, date } object
const tagText = (entry) => !entry ? "" : (typeof entry === "string" ? entry : (entry.text || ""));
// settled-bet tint for a tagged game's exported background: W/L/P -> color, else null
const RESULT_BG = { W:"rgba(27,127,92,0.20)", L:"rgba(215,38,61,0.18)", P:"rgba(43,76,126,0.18)" };
const tagResultBg = (entry) => {
  const result = entry && typeof entry === "object" ? entry.result : null;
  return result ? RESULT_BG[result] : null;
};
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }); } catch { return ""; } };

// Draw the tagged play as green monospace "code" text, right-aligned at
// (rightX, cy) — matching today's-slate's terminal look instead of the old
// red marker handwriting. Shrinks to fit maxW if needed, no rotation.
function drawGreenTag(x, text, leftX, cy, maxW, fontSize = 14, color = "#39D98A") {
  if (!text) return;
  x.save();
  let size = fontSize;
  x.font = `700 ${size}px ${MONO}`;
  while (x.measureText(text).width > maxW && size > 8) {
    size -= 0.5;
    x.font = `700 ${size}px ${MONO}`;
  }
  x.fillStyle = color;
  x.textAlign = "left"; x.textBaseline = "middle";
  x.fillText(text, leftX, cy);
  x.restore();
}

// preloaded once at module scope so it's already decoded by the time an
// export runs. exportCard/copySlate stay synchronous right up to their
// copyCanvas() call (see its own comment) — Safari/iOS only honors the
// clipboard write as a direct user gesture if nothing async (like awaiting
// an image load) happens in between, so the logo has to already be ready.
const hotNutLogoImg = (() => {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = hotNutLogo;
  return img;
})();

function roundedRectPath(x, left, top, w, h, r) {
  x.beginPath();
  x.moveTo(left+r,top); x.arcTo(left+w,top,left+w,top+h,r); x.arcTo(left+w,top+h,left,top+h,r);
  x.arcTo(left,top+h,left,top,r); x.arcTo(left,top,left+w,top,r); x.closePath();
}

// small logo icon in the gap between the team names and the play indicator
// on an exported card row — skipped silently if the image hasn't finished
// decoding yet (only possible if export is clicked within moments of the
// page loading).
function drawLogoIcon(x, centerX, centerY, size) {
  if (!hotNutLogoImg || !hotNutLogoImg.complete || !hotNutLogoImg.naturalWidth) return;
  x.drawImage(hotNutLogoImg, centerX - size/2, centerY - size/2, size, size);
}

// a play's grade indicator box: empty outline until graded, then filled
// solid with a check (win), ex (loss), or "P" (push).
function drawPlayIndicator(x, result, bx, by, size = 14) {
  const rr = 3;
  x.save();
  x.beginPath();
  x.moveTo(bx+rr,by); x.arcTo(bx+size,by,bx+size,by+size,rr); x.arcTo(bx+size,by+size,bx,by+size,rr);
  x.arcTo(bx,by+size,bx,by,rr); x.arcTo(bx,by,bx+size,by,rr); x.closePath();
  if (result === "W" || result === "L" || result === "P") {
    x.fillStyle = result==="W" ? "#1B7F5C" : result==="L" ? "#D7263D" : "#2B4C7E";
    x.fill();
    x.fillStyle = "#fff"; x.font = `700 ${Math.round(size*0.72)}px ${MONO}`;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(result==="W" ? "✓" : result==="L" ? "✕" : "P", bx+size/2, by+size/2+0.5);
  } else {
    x.strokeStyle = "#57616F"; x.lineWidth = 1.4; x.stroke();
  }
  x.restore();
}

// strips a leading "PLAY" convention off a tagged pick before drawing it —
// redundant on an exported image that's already understood to be a play
const stripPlayPrefix = (t) => (t||"").replace(/^\s*play\s*[·:\-–]?\s*/i, "");

// hand-drawn line chart for the exported plays card — mirrors the live
// Recharts "cumulative net" chart (dashed zero line, dots only at local
// highs/lows) without pulling Recharts into a raster export.
function drawNetChart(x, left, top, w, h, data, dotIdx) {
  roundedRectPath(x, left, top, w, h, 4);
  x.fillStyle = "#fff"; x.fill();
  x.strokeStyle = "#CDD3DA"; x.lineWidth = 1; x.stroke();
  if (data.length < 2) {
    x.fillStyle = "#9AA3AD"; x.font = `10px ${MONO}`;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("Grade at least 1 play to see the trend", left+w/2, top+h/2);
    return;
  }
  const padX = 12, padY = 16;
  const cx0 = left+padX, cx1 = left+w-padX, cy0 = top+padY, cy1 = top+h-padY;
  const nets = data.map(d=>d.net);
  let min = Math.min(0, ...nets), max = Math.max(0, ...nets);
  if (min===max) { min -= 1; max += 1; }
  const xAt = (i) => cx0 + (i/(data.length-1)) * (cx1-cx0);
  const yAt = (v) => cy1 - ((v-min)/(max-min)) * (cy1-cy0);
  if (min < 0 && max > 0) {
    x.save();
    x.setLineDash([3,3]); x.strokeStyle = "#9AA3AD"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx0, yAt(0)); x.lineTo(cx1, yAt(0)); x.stroke();
    x.restore();
  }
  x.strokeStyle = "#2B4C7E"; x.lineWidth = 2; x.beginPath();
  data.forEach((d,i)=>{ const px=xAt(i), py=yAt(d.net); if (i===0) x.moveTo(px,py); else x.lineTo(px,py); });
  x.stroke();
  data.forEach((d,i)=>{
    if (!dotIdx.has(i)) return;
    x.beginPath(); x.arc(xAt(i), yAt(d.net), 2.5, 0, Math.PI*2);
    x.fillStyle = "#2B4C7E"; x.fill();
  });
}

// one row of the exported "last 10 plays" list. A play that hasn't been
// graded yet still shows — matchup and the game's date stay legible — but
// the pick text and its exact first-pitch time are redacted behind a solid
// black bar (with black text drawn on top of it) so nothing is legible
// until the play is graded.
function drawPlaysRow(x, left, top, w, h, r) {
  const graded = r.result==="W" || r.result==="L" || r.result==="P";
  const tint = r.result==="W" ? "rgba(27,127,92,0.10)"
    : r.result==="L" ? "rgba(215,38,61,0.09)"
    : r.result==="P" ? "rgba(43,76,126,0.09)" : "#fff";
  const edge = r.result==="W" ? "#1B7F5C" : r.result==="L" ? "#D7263D"
    : r.result==="P" ? "#2B4C7E" : "#CDD3DA";
  roundedRectPath(x, left, top, w, h, 4);
  x.fillStyle = tint; x.fill();
  x.strokeStyle = "#CDD3DA"; x.lineWidth = 1; x.stroke();
  x.fillStyle = edge; x.fillRect(left, top, 3, h);

  const cy = top + h/2;
  drawLogoIcon(x, left+18, cy, 16);

  x.textAlign = "left"; x.textBaseline = "middle";
  const matchup = r.away && r.home ? `${TEAM_ABBR[r.awayId]||r.away}@${TEAM_ABBR[r.homeId]||r.home}` : "";
  x.fillStyle = "#525A66"; x.font = `700 10px ${MONO}`;
  x.fillText(matchup, left+32, cy);

  const indicatorX = left+w-20;
  const dateTimeRight = indicatorX - 10;
  const dateTimeW = 60;
  const playStartX = left+90;
  const playMaxW = Math.max(20, (dateTimeRight-dateTimeW) - playStartX);
  const playText = stripPlayPrefix(r.text);

  drawPlayIndicator(x, r.result, indicatorX, top+h/2-8, 16);

  if (graded) {
    drawGreenTag(x, playText, playStartX, cy, playMaxW, 12, C.ink);
  } else {
    const padB = 6;
    roundedRectPath(x, playStartX-padB, top+4, playMaxW+padB*2, h-8, 3);
    x.fillStyle = C.ink; x.fill();
    drawGreenTag(x, playText, playStartX, cy, playMaxW, 12, C.ink);
  }

  const dateStr = r.date ? calDay(r.date).md : "";
  const timeStr = r.time ? fmtTime(r.time) : "";
  x.textAlign = "right";
  x.fillStyle = "#9AA3AD"; x.font = `10px ${MONO}`;
  x.fillText(dateStr, dateTimeRight, cy-6);
  if (graded) {
    x.fillText(timeStr, dateTimeRight, cy+6);
  } else if (timeStr) {
    const padB = 4;
    roundedRectPath(x, dateTimeRight-dateTimeW-padB, cy, dateTimeW+padB*2, 14, 3);
    x.fillStyle = C.ink; x.fill();
    x.fillStyle = C.ink; x.font = `10px ${MONO}`;
    x.fillText(timeStr, dateTimeRight, cy+7);
  }
}

// Copy a canvas to the clipboard as PNG. Called synchronously in the click
// handler and hands ClipboardItem a Promise<Blob> so the browser keeps the
// user-gesture context (Safari/iOS require this). Falls back to download.
// setStatus(code): "ok" | "dl" | "err".
function copyCanvas(cv, filename, setStatus) {
  const done = (s)=>{ setStatus(s); setTimeout(()=>setStatus(null), 2000); };
  const blobPromise = new Promise((resolve, reject)=>{
    cv.toBlob(b => b ? resolve(b) : reject(new Error("no blob")), "image/png");
  });
  try {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([ new window.ClipboardItem({ "image/png": blobPromise }) ])
        .then(()=>done("ok"))
        .catch(()=>{ blobPromise.then(b=>downloadBlob(b, filename)).then(()=>done("dl")).catch(()=>done("err")); });
    } else {
      blobPromise.then(b=>downloadBlob(b, filename)).then(()=>done("dl")).catch(()=>done("err"));
    }
  } catch { blobPromise.then(b=>downloadBlob(b, filename)).then(()=>done("dl")).catch(()=>done("err")); }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// shared per-game tag store (global via JSONBin, local cache via localStorage).
// Returns { tags, tagStatus, setTag, setResult }.
function useTags() {
  const [tags, setTags] = useState({});
  const [tagStatus, setTagStatus] = useState(NOTES_URL ? "loading" : "local");
  const tagTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    try { const c = window.localStorage.getItem("ts-tags"); if (c!=null) setTags(JSON.parse(c)||{}); } catch {}
    if (!NOTES_URL) return;
    (async () => {
      try {
        const r = await fetch(NOTES_URL + "/latest",
          { headers:{ "X-Master-Key":NOTES_KEY, "X-Access-Key":NOTES_KEY } });
        const j = await r.json();
        if (!alive) return;
        const stored = j?.record?.tags;
        if (stored && typeof stored === "object") {
          setTags(stored);
          try { window.localStorage.setItem("ts-tags", JSON.stringify(stored)); } catch {}
        }
        setTagStatus("saved");
      } catch { if (alive) setTagStatus("error"); }
    })();
    return () => { alive = false; };
  }, []);

  const persist = (next) => {
    try { window.localStorage.setItem("ts-tags", JSON.stringify(next)); } catch {}
    if (!NOTES_URL) return;
    setTagStatus("saving");
    if (tagTimer.current) clearTimeout(tagTimer.current);
    tagTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(NOTES_URL, { method:"PUT",
          headers:{ "Content-Type":"application/json",
            "X-Master-Key":NOTES_KEY, "X-Access-Key":NOTES_KEY },
          body:JSON.stringify({ tags:next }) });
        setTagStatus(r.ok ? "saved" : "error");
      } catch { setTagStatus("error"); }
    }, 700);
  };

  // setTag(game, text): create/update/remove a tag, keeping a self-describing snapshot
  const setTag = (game, text) => {
    setTags(prev => {
      const next = { ...prev };
      const v = (text||"").trim();
      if (v) {
        const existing = (typeof prev[game.gamePk] === "object") ? prev[game.gamePk] : {};
        next[game.gamePk] = { ...existing, text:v, away:game.awayName, home:game.homeName,
          awayId:game.awayId, homeId:game.homeId, time:game.time||"",
          date: game.gameDay || (game.time||"").slice(0,10) || "" };
      } else {
        delete next[game.gamePk];
      }
      persist(next);
      return next;
    });
  };

  // setResult(gamePk, "W"|"L"|null): mark or clear a win/loss on an existing tag
  const setResult = (gamePk, result) => {
    setTags(prev => {
      const entry = prev[gamePk];
      if (!entry) return prev;
      const obj = typeof entry === "string" ? { text:entry } : { ...entry };
      if (result) obj.result = result; else delete obj.result;
      const next = { ...prev, [gamePk]:obj };
      persist(next);
      return next;
    });
  };

  // setStarred(gamePk, bool): toggle a play as a standout pick
  const setStarred = (gamePk, starred) => {
    setTags(prev => {
      const entry = prev[gamePk];
      if (!entry) return prev;
      const obj = typeof entry === "string" ? { text:entry } : { ...entry };
      if (starred) obj.starred = true; else delete obj.starred;
      const next = { ...prev, [gamePk]:obj };
      persist(next);
      return next;
    });
  };

  return { tags, tagStatus, setTag, setResult, setStarred };
}

/* streak echo: a team that just snapped a long W or L streak. `results` is
   [{date,res:"W"|"L"}]. Returns the broken streak's length/result plus the
   "predicted" repeat (the result that ended the streak), or null. */
function detectStreakBreak(results, minLen) {
  if (!results || results.length < minLen + 1) return null;
  const r = results.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const lastRes = r[r.length-1].res;              // the game that broke the streak
  // count the run of the OPPOSITE result immediately before the last game
  const prior = lastRes === "W" ? "L" : "W";
  let streakLen = 0;
  for (let i=r.length-2; i>=0; i--){
    if (r[i].res === prior) streakLen++; else break;
  }
  if (streakLen < minLen) return null;
  return { streakLen, streakRes: prior, predicted: lastRes };
}

/* late go-ahead: winner first took the lead in the 8th inning or later.
   `ls` is an MLB linescore; winnerSide is "home"|"away". Returns
   {firstLeadInning} or null. Checked after EACH half-inning, not just once
   per full inning — the away team scoring in the top half puts them ahead
   the moment that run crosses the plate, even if the home team ties it back
   up in the bottom half of that same inning. Netting the two halves together
   before checking would hide that brief lead entirely. */
function detectLateComeback(ls, winnerSide) {
  const innings = ls?.innings || [];
  let homeCum = 0, awayCum = 0;
  for (const inn of innings) {
    const num = inn.num || 0;
    awayCum += Number(inn.away?.runs)||0;   // top half: away bats first
    if ((winnerSide === "away" ? awayCum > homeCum : homeCum > awayCum))
      return num >= 8 ? { firstLeadInning: num } : null;   // first lead must be 8th+
    homeCum += Number(inn.home?.runs)||0;   // bottom half: home bats
    if ((winnerSide === "home" ? homeCum > awayCum : awayCum > homeCum))
      return num >= 8 ? { firstLeadInning: num } : null;
  }
  return null;
}

/* ───────────────────────── shared UI bits ───────────────────────── */
const Eyebrow = ({ children, n }) => (
  <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
    {n && <span style={{ fontFamily:MONO, fontSize:12, color:C.ruleDark }}>{n}</span>}
    <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:"0.18em",
      textTransform:"uppercase", color:C.inkSoft }}>{children}</span>
    <span style={{ flex:1, height:1, background:C.rule }} />
  </div>
);
const Field = ({ label, children }) => (
  <label style={{ display:"block" }}>
    <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.14em",
      textTransform:"uppercase", color:C.inkSoft, marginBottom:5 }}>{label}</div>
    {children}
  </label>
);
// iOS Safari zooms the page in on focus for any input/select with a
// computed font-size under 16px — keep it at 16 so focusing a field
// (the tag editor, the prop-analyzer fields) never triggers that zoom.
const inputStyle = {
  boxSizing:"border-box", padding:"9px 11px", border:`1px solid ${C.rule}`,
  borderRadius:2, background:"#fff", fontFamily:SANS, fontSize:16, color:C.ink, outline:"none",
};
const ErrBox = ({ children }) => (
  <div style={{ padding:"12px 14px", background:"#FCEBED", border:`1px solid ${C.under}`,
    borderRadius:2, color:C.under, fontFamily:SANS, fontSize:13, marginBottom:16 }}>{children}</div>
);
// solid green check = confirmed; outline clock = still pending/projected.
// `color` sets the pending state's stroke so it reads on either a light or
// dark background — the confirmed state's green+white always reads on both.
function ConfirmBadge({ confirmed, color = C.ruleDark, size = 13, title }) {
  return confirmed ? (
    <svg width={size} height={size} viewBox="0 0 24 24" title={title} style={{ flexShrink:0 }}>
      <circle cx="12" cy="12" r="11" fill={C.over} />
      <path d="M7 12.3l3.3 3.3L17 9" stroke="#fff" strokeWidth="2.3" fill="none"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" title={title} style={{ flexShrink:0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.6" fill="none"/>
      <path d="M12 7.5v5l3.2 2" stroke={color} strokeWidth="1.6" fill="none"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const ROW_COLS = "minmax(36px,1fr) 30px 60px 9px 60px 9px 60px";
const SEP = <span style={{ textAlign:"center", fontFamily:MONO, fontSize:12,
  color:C.ruleDark, fontWeight:700 }}>|</span>;

const CAT = {
  ht: (v)=> v===0 ? "r" : v>=2 ? "g" : "b",   // hits / total bases / HRR
};
function last3Same(arr, fn) {
  if (!arr || arr.length < 3) return null;
  const c = arr.slice(-3).map(fn);
  if (c.every(x=>x==="r")) return "r";
  if (c.every(x=>x==="g")) return "g";
  return null;
}
/* hot if ANY of H / TB / HRR has its last 3 all red or all green */
function nameStreak(p) {
  return [last3Same(p.h, CAT.ht), last3Same(p.tb, CAT.ht), last3Same(p.hrr, CAT.ht)]
    .some(x => x === "r" || x === "g");
}

// "Aaron Judge" -> "A. Judge" — mobile-only lineup rows, where there's no
// room for the full first name alongside the stat columns
function abbrevName(name) {
  if (!name) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

/* one stat's last-5 as a fixed 5-cell grid; marked + clickable when 3-in-a-row */
function SeqBlock({ arr, label, onPick }) {
  const on = !!last3Same(arr, CAT.ht);
  const hue = (v)=> v===0 ? C.under : v>=2 ? C.over : C.ink;
  const vals = arr && arr.length ? arr : [null,null,null,null,null];
  const cells = (
    <span style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", width:"100%" }}>
      {vals.map((v,i)=>(
        <span key={i} style={{ textAlign:"center", fontFamily:MONO, fontSize:11,
          color: v==null ? C.ruleDark : hue(v) }}>{v==null ? "·" : v}</span>
      ))}
    </span>
  );
  const base = { display:"block", width:"100%", borderRadius:1, boxSizing:"border-box",
    ...(on ? { background:"rgba(255,233,77,0.65)", boxShadow:`inset 0 0 0 1px ${C.markerDeep}` } : {}) };
  if (onPick) {
    return <button onClick={onPick} title={`Analyze ${label} prop`}
      style={{ ...base, border:"none", padding:0, cursor:"pointer", font:"inherit" }}>{cells}</button>;
  }
  return <span style={base}>{cells}</span>;
}

/* ════════════════════ MY TRENDS (yesterday → +5 days) ════════════════════ */
function TravelTrends({ tags, setTag, onReady }) {
  // anchor: today by default, adjustable — see the CALENDAR tab button,
  // which doubles as a date picker once it's already the active tab
  const [anchor, setAnchor] = useState(todayISO());
  const start = anchor;
  const minStreak = 10;                        // fixed threshold
  const [days, setDays] = useState(null);
  const [echoes, setEchoes] = useState(null);
  const [comebacks, setComebacks] = useState(null);
  const [faced, setFaced] = useState({});      // pitcherId -> Set(opponent team ids)
  const [formerTeams, setFormerTeams] = useState({});  // pitcherId -> Set(team ids played for across 2+ seasons)
  const [runsMap, setRunsMap] = useState({});  // teamId -> { date -> runs scored }
  const [hitsMap, setHitsMap] = useState({});  // teamId -> { date -> hits }
  const [oppMap, setOppMap] = useState({});    // teamId -> { date -> opponent teamId } — who each
                                                // last-5 batting-line entry was actually played against
  const [battingScoreMap, setBattingScoreMap] = useState({});  // teamId -> { date -> 0-10 score }
  const [scheduleMap, setScheduleMap] = useState({});  // teamId -> [{date, oppPid}] sorted ascending
  const [modal, setModal] = useState(null);    // { date, g, t } of clicked game
  const [now, setNow] = useState(()=>new Date());
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()), 60000); return ()=>clearInterval(id); }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showIndicators, setShowIndicators] = useState(true);
  const westThreshold = TZ_RANK.MT;             // PT/MT count as "west"
  // situational-trend data (echoes/comebacks/rematches/big-day/slump-boom)
  // only needs to be pulled & computed once per day — tracks the date it was
  // last loaded for, so a manual refresh can skip straight past it and just
  // re-pull live scores/state instead of redoing all of that work every click.
  const indicatorsLoadedForRef = useRef(null);
  // team ids whose batting line (last-5 quality-adjusted score + hits) has
  // already been fetched or is in flight, via ensureBattingLine — reset
  // alongside the other indicator state whenever the visible window moves.
  const battingLineFetchedRef = useRef(new Set());

  const load = useCallback(async () => {
    const needIndicators = indicatorsLoadedForRef.current !== start;
    // keep showing the current calendar while refreshing (setDays isn't
    // cleared here) so a manual refresh doesn't unmount the scroll
    // container and reset which day is in view
    setErr("");
    if (needIndicators) { setEchoes(null); setComebacks(null); setFaced({}); setFormerTeams({}); setRunsMap({}); setHitsMap({}); setOppMap({}); setBattingScoreMap({}); setScheduleMap({}); battingLineFetchedRef.current = new Set(); }
    setBusy(true);
    try {
      /* ── window schedule (travel + next-game lookup + probable pitchers) ──
         fetch from 4 days back so the -3 day's travel has a "prev day". */
      const from = addDays(start,-4), to = addDays(start,3);
      const r = await fetch(`${API}/schedule?sportId=1&startDate=${from}&endDate=${to}` +
        `&gameType=R&hydrate=probablePitcher,linescore(runners),lineups`);
      if (!r.ok) throw new Error(`schedule ${r.status}`);
      const j = await r.json();
      const byTeamDate = {};   // teamId -> { date -> venueTz }
      const dayGames = {};     // date -> [games]
      const scheduleByTeam = {};  // teamId -> [{date, oppPid}] — every probable
                                  // starter each team is scheduled to face across
                                  // the visible window, in order, for the gauntlet
                                  // (2-3 straight sub-3.00-ERA starters) trend
      (j.dates||[]).forEach(d=>{
        dayGames[d.date] = [];
        (d.games||[]).forEach(g=>{
          const home=g.teams.home.team, away=g.teams.away.team;
          const venueTz = TEAM_TZ[home.id] ?? "?";
          const ap = g.teams.away.probablePitcher, hp = g.teams.home.probablePitcher;
          const isFinal = g.status?.abstractGameState==="Final";
          const isLive = g.status?.abstractGameState==="Live";
          dayGames[d.date].push({ homeId:home.id, homeName:home.name,
            awayId:away.id, awayName:away.name, venueTz, time:g.gameDate,
            gameDay: g.officialDate || d.date,
            awayPid:ap?.id, awayPname:ap?.fullName, homePid:hp?.id, homePname:hp?.fullName,
            isFinal, isLive,
            awayScore: g.teams.away.score, homeScore: g.teams.home.score,
            awayHits: g.linescore?.teams?.away?.hits, homeHits: g.linescore?.teams?.home?.hits,
            inningNum: g.linescore?.currentInning, inningState: g.linescore?.inningState,
            outs: g.linescore?.outs,
            onFirst: !!g.linescore?.offense?.first, onSecond: !!g.linescore?.offense?.second,
            onThird: !!g.linescore?.offense?.third,
            gamePk:g.gamePk, _raw:g,
            pair:[away.id,home.id].sort((x,y)=>x-y).join("-") });
          [home.id, away.id].forEach(tid=>{
            (byTeamDate[tid] = byTeamDate[tid]||{})[d.date] = venueTz; });
          // gamePk (not just date) identifies the exact game — a doubleheader
          // puts two of these in a row for the same team on the same date
          if (hp?.id) (scheduleByTeam[away.id] = scheduleByTeam[away.id]||[]).push({ date:d.date, time:g.gameDate, gamePk:g.gamePk, oppPid:hp.id, isFinal, side:"away" });
          if (ap?.id) (scheduleByTeam[home.id] = scheduleByTeam[home.id]||[]).push({ date:d.date, time:g.gameDate, gamePk:g.gamePk, oppPid:ap.id, isFinal, side:"home" });
        });
      });
      Object.values(scheduleByTeam).forEach(list=>list.sort((a,b)=>a.time.localeCompare(b.time)));

      const buildList = (date) => {
        const prev = addDays(date,-1);
        return (dayGames[date]||[]).map(g=>{
          const todayTz = TZ_RANK[g.venueTz], travelers=[];
          [["away",g.awayId,g.awayName],["home",g.homeId,g.homeName]].forEach(([,tid,tname])=>{
            const prevTz = TZ_RANK[byTeamDate[tid]?.[prev]];
            if (prevTz!=null && todayTz===TZ_RANK.ET && prevTz<=westThreshold)
              travelers.push({ teamId:tid, tname, from:byTeamDate[tid][prev], to:g.venueTz });
          });
          /* ── TEMPORARY TEST INDICATOR — extras-then-matinee ──────────────
             A team that played a night game which ran into extra innings and
             is back out for a matinee today: latest possible finish, earliest
             possible start. Piggybacks on the B2B travel slot rather than
             taking a box of its own, so nothing about the grid changes — the
             only tell is the box's hover title (see travelKind). Delete this
             block, travelKind, TZ_UTC_OFFSET/localStartHour and the `grinders`
             references in computeGameTrends to remove it cleanly. */
          const todayStart = localStartHour(g.time, g.venueTz);
          const grinders = [];
          if (todayStart!=null && todayStart < 16) {
            [["away",g.awayId,g.awayName],["home",g.homeId,g.homeName]].forEach(([,tid,tname])=>{
              const last = (dayGames[prev]||[]).find(p => p.awayId===tid || p.homeId===tid);
              if (!last || !last.isFinal) return;
              const innings = Number(last.inningNum)||0;
              const lastStart = localStartHour(last.time, last.venueTz);
              if (innings >= 10 && lastStart!=null && lastStart >= 17)
                grinders.push({ teamId:tid, tname, innings, lastStart, todayStart });
            });
          }
          return { ...g, travelers, grinders, flagged:travelers.length>0 };
        }).sort((a,b)=>a.time.localeCompare(b.time));
      };

      // ── Calendar layout — wavefront ─────────────────────────────────
      // 1. Place today's games. Each becomes a seed: find every matching
      //    game (same matchup, 1 off-day gap tolerated) across all columns
      //    and lock it into that seed's row + color (navy/gray for today).
      // 2. Expand outward one column on each side. Any game there still
      //    without a home fills the lowest empty gap (white/gray) and itself
      //    becomes a seed — its matchups are found and locked into its row.
      // 3. Repeat outward (2 cols, 3 cols) until the edges.
      // ────────────────────────────────────────────────────────────────

      const TODAY_DI = 3;
      const DATES = [];
      for(let i=-3;i<=3;i++) DATES.push(addDays(start,i));
      const perDay = DATES.map(d=>buildList(d));   // sorted by start time
      const numDays = DATES.length;

      // who each team played each day (undefined if off)
      const oppByTeamDay = Array.from({length:numDays}, ()=>({}));
      perDay.forEach((games,di)=>games.forEach(g=>{
        oppByTeamDay[di][g.awayId] = g.homeId;
        oppByTeamDay[di][g.homeId] = g.awayId;
      }));
      // doubleheaders put two games on the same pair/day — dayByPair only
      // keeps one game per pair per day (it's the anchor used to continue a
      // series row across other days), so always prefer the non-makeup game
      // as that anchor; the other game still gets its own row below since
      // placement is tracked per game, not per pair.
      const isMakeup = (g) => /makeup/i.test(g._raw?.description || "");
      const dayByPair = perDay.map(games=>{
        const m={};
        games.forEach(g=>{
          const existing = m[g.pair];
          if (!existing || (isMakeup(existing) && !isMakeup(g))) m[g.pair]=g;
        });
        return m;
      });

      const grid   = Array.from({length:numDays}, ()=>[]);    // grid[di][row]=game|"RESV"|null
      const placed = Array.from({length:numDays}, ()=>({}));  // di -> gamePk -> true
      const RESV = "__reserved__";   // blocks a cell (series gap) but renders blank
      const putAt = (di,row,g,shade)=>{
        while(grid[di].length<=row) grid[di].push(null);
        grid[di][row]=g; placed[di][g.gamePk]=true; g.seriesShade=shade;
      };
      const reserve = (di,row)=>{     // hold a cell blank if it's currently free
        while(grid[di].length<=row) grid[di].push(null);
        if(grid[di][row]==null) grid[di][row]=RESV;
      };
      const isFree = (v)=> v===undefined || v===null;   // RESV is NOT free
      const nextFreeFrom = (di,row)=>{
        let r=row<0?0:row;
        while(!isFree(grid[di][r])) r++;
        return r;
      };

      // A series (awayId vs homeId) is continuous from day a to day b if
      // neither team faced a DIFFERENT opponent on any day strictly between.
      // (off days in between are allowed — they don't break the series.)
      const continuous = (awayId, homeId, a, b)=>{
        const lo=Math.min(a,b)+1, hi=Math.max(a,b)-1;
        for(let d=lo; d<=hi; d++){
          const ao=oppByTeamDay[d][awayId], ho=oppByTeamDay[d][homeId];
          if(ao!=null && ao!==homeId) return false;
          if(ho!=null && ho!==awayId) return false;
        }
        return true;
      };

      // place a seed game, then lock every matching game (gap-tolerant) into
      // the SAME row + shade across all columns. When a match sits across a
      // one-day (or longer) off-day gap, RESERVE that row on the in-between
      // off-days so no other game breaks the series line — the cell stays blank.
      const seed = (di, row, g, shade)=>{
        putAt(di, row, g, shade);
        for(let d=0; d<numDays; d++){
          if(d===di) continue;
          const match = dayByPair[d][g.pair];
          if(match && !placed[d][match.gamePk] && continuous(g.awayId, g.homeId, di, d)){
            const r = nextFreeFrom(d, row);   // prefer the seed's row
            putAt(d, r, match, shade);
            // reserve the same row on the off-days between di and d
            const lo=Math.min(di,d)+1, hi=Math.max(di,d)-1;
            for(let b=lo; b<=hi; b++){
              if(!dayByPair[b][g.pair]) reserve(b, r);   // pair is off that day → hold blank
            }
          }
        }
      };

      // ---- step 1: seed today's games (navy/gray), each propagates ----
      perDay[TODAY_DI].forEach((g,row)=>{
        if(placed[TODAY_DI][g.gamePk]) return;
        seed(TODAY_DI, row, g, 2 + (row%2));   // 2=navy, 3=darker-gray
      });

      // ---- steps 2+: expand outward; new gap-fills (white/gray) re-seed ----
      for(let radius=1; radius<=Math.max(TODAY_DI, numDays-1-TODAY_DI); radius++){
        for(const di of [TODAY_DI-radius, TODAY_DI+radius]){
          if(di<0 || di>=numDays) continue;
          perDay[di].forEach(g=>{
            if(placed[di][g.gamePk]) return;     // already locked by a seed
            const r = nextFreeFrom(di, 0);
            seed(di, r, g, 0 + (r%2));           // white/light-gray, and re-seed
          });
        }
      }

      // ---- trim trailing nulls per column; RESV cells become blank (null) ----
      const out = DATES.map((d,di)=>{
        const col = grid[di].map(c => c===RESV ? null : c);
        let last=-1; col.forEach((g,i)=>{ if(g) last=i; });
        return { date:d, games: last===-1 ? [] : col.slice(0,last+1) };
      });
      setDays(out);

      // situational-trend data already loaded for today — the refresh button
      // only needed live scores/state, so stop here and leave it alone.
      if (!needIndicators) return;

      /* ── streak-break echo: pull ~5 wks of finals, find snapped streaks ──
         include today so a trend that completes today (game just went final)
         is picked up on refresh and shows up on the team's next game. */
      const lbFrom = addDays(start,-35), lbTo = start;
      const lr = await fetch(`${API}/schedule?sportId=1&startDate=${lbFrom}&endDate=${lbTo}` +
        `&gameType=R&hydrate=linescore`);
      const lj = await lr.json();
      const finals = (lj.dates||[]).flatMap(d=>d.games||[])
        .filter(g=>g.status?.abstractGameState==="Final")
        .sort((a,b)=>a.gameDate.localeCompare(b.gameDate));
      const byTeamRes = {};    // teamId -> [{date,res}]
      const teamName = {};
      const runsByDate = {};   // teamId -> { gameTime -> runs scored }
      const hitsByDate = {};   // teamId -> { gameTime -> hits }
      const oppByDate = {};    // teamId -> { gameTime -> opponent teamId } — who was
                               // actually played that game, for the last-5 abbreviation label
      const gamePkByDate = {}; // teamId -> { gameTime -> { gamePk, side } } — which
                               // specific game fed that entry, and which side this
                               // team batted from (used below to look up the
                               // opposing pitchers' box-score lines). Keyed by the
                               // exact game timestamp, not just the date — a
                               // doubleheader's two games share a date, and keying
                               // by date alone would let the second game silently
                               // overwrite the first instead of both counting as
                               // separate "previous games."
      finals.forEach(g=>{
        ["home","away"].forEach(side=>{
          const t = g.teams[side];
          if (typeof t.isWinner !== "boolean") return;
          teamName[t.team.id] = t.team.name;
          (byTeamRes[t.team.id] = byTeamRes[t.team.id]||[])
            .push({ date:g.gameDate, res: t.isWinner ? "W":"L" });
          const runs = Number(t.score);
          if (!isNaN(runs)) {
            const m = runsByDate[t.team.id] = runsByDate[t.team.id]||{};
            m[g.gameDate] = runs;
          }
          const hits = Number(g.linescore?.teams?.[side]?.hits);
          if (!isNaN(hits)) {
            const hm = hitsByDate[t.team.id] = hitsByDate[t.team.id]||{};
            hm[g.gameDate] = hits;
            (gamePkByDate[t.team.id] = gamePkByDate[t.team.id]||{})[g.gameDate] = { gamePk:g.gamePk, side };
            const oppId = g.teams[side==="home"?"away":"home"].team.id;
            (oppByDate[t.team.id] = oppByDate[t.team.id]||{})[g.gameDate] = oppId;
          }
        });
      });
      // scheduleByTeam (built from the main window fetch, -3..+4 days) only
      // covers the visible calendar; merge in any earlier games this fetch
      // found (up to 35 days back) that aren't already in it, so "the game
      // right before this one" can still be found correctly for a game
      // sitting near the start of the visible window, whose real previous
      // game may be further back than the window itself reaches.
      Object.entries(gamePkByDate).forEach(([tid, games])=>{
        const list = scheduleByTeam[tid] = scheduleByTeam[tid] || [];
        const known = new Set(list.map(s=>s.gamePk));
        Object.entries(games).forEach(([time, { gamePk, side }])=>{
          // every entry here comes from the completed-games (`finals`) list
          if (!known.has(gamePk)) list.push({ date:time.slice(0,10), time, gamePk, oppPid:null, isFinal:true, side });
        });
      });
      Object.values(scheduleByTeam).forEach(list=>list.sort((a,b)=>a.time.localeCompare(b.time)));
      setScheduleMap(scheduleByTeam);
      // set each indicator's data as soon as it's actually ready, instead of
      // batching everything until the very end — the big-day box (needs only
      // runsByDate, already in hand) lights up well before rematch/gauntlet
      // /revenge (need a further pitcher fetch) or the BAT trio (needs a
      // further box-score fetch on top of that), so the calendar fills in
      // progressively rather than popping in all at once when everything
      // finishes.
      setRunsMap(runsByDate);
      setHitsMap(hitsByDate);
      setOppMap(oppByDate);
      const echoList = [];
      Object.entries(byTeamRes).forEach(([tid, res])=>{
        const sig = detectStreakBreak(res, Number(minStreak)||10);
        if (!sig) return;
        // find this team's next game strictly after the streak-breaking result
        // (not from a fixed "today" — if that result was today's own game,
        // searching from today would re-attach the marker to that same game)
        const lastDate = res[res.length-1].date.slice(0,10);
        let found = null;
        for (let i=1;i<=5 && !found;i++){
          const date = addDays(lastDate,i);
          (dayGames[date]||[]).forEach(g=>{
            if (!found && (g.homeId===Number(tid) || g.awayId===Number(tid)))
              found = { date, ...g };
          });
        }
        if (!found) return;
        echoList.push({ ...sig, teamId:Number(tid), team:teamName[tid],
          date:found.date, awayName:found.awayName, homeName:found.homeName,
          venueTz:found.venueTz });
      });
      echoList.sort((a,b)=>a.date.localeCompare(b.date));
      setEchoes(echoList);

      /* ── late go-ahead win: scan yesterday's (and today's, once final)
         finals via linescore, so a comeback that completes today shows up
         on the team's next game as soon as it's refreshed ── */
      const yISO = addDays(start,-1);
      const yGames = finals.filter(g => {
        const gd = g.officialDate || g.gameDate.slice(0,10);
        return gd === yISO || gd === start;
      });
      const comebackTask = (async () => {
      const cbResults = await mapPool(yGames, 4, async (g) => {
        const winnerSide = g.teams.home.isWinner ? "home" : "away";
        const gd = g.officialDate || g.gameDate.slice(0,10);
        try {
          const lr2 = await fetch(`${API}/game/${g.gamePk}/linescore`);
          if (!lr2.ok) return null;
          const ls = await lr2.json();
          const sig = detectLateComeback(ls, winnerSide);
          if (!sig) return null;
          const win = g.teams[winnerSide], lose = g.teams[winnerSide==="home"?"away":"home"];
          // this team's next scheduled game strictly after this win (not a
          // fixed "today" — if this win was today's own game, searching from
          // today would re-attach the marker to that same game)
          let next = null;
          for (let i=1;i<=5 && !next;i++){
            const date = addDays(gd,i);
            (dayGames[date]||[]).forEach(dg=>{
              if (!next && (dg.homeId===win.team.id || dg.awayId===win.team.id))
                next = { date, awayName:dg.awayName, homeName:dg.homeName };
            });
          }
          return { team:win.team.name, teamId:win.team.id, opp:lose.team.name,
            score:`${win.score}\u2013${lose.score}`, inning:sig.firstLeadInning, next };
        } catch { return null; }
      });
      const cbList = cbResults.filter(Boolean).sort((a,b)=>b.inning-a.inning);
      setComebacks(cbList);
      })();

      /* ── pitcher rematch: has each probable already faced today's opponent? ── */
      const pitcherIds = new Set();
      Object.values(dayGames).flat().forEach(g=>{
        if (g.awayPid) pitcherIds.add(g.awayPid);
        if (g.homePid) pitcherIds.add(g.homePid);
      });
      // These three phases share nothing, so they run together and each
      // publishes the moment its OWN data lands rather than waiting on the
      // slowest. That matters most for `faced`: it feeds the ERA number, the
      // rematch verdict and the gauntlet, and it used to sit finished but
      // unpublished while the yearByYear fetch for Homecoming Jinx — which
      // nothing on that path needs — ran to completion behind it.
      const facedTask = (async () => {
      const facedMap = {};
      await mapPool([...pitcherIds], 6, async (pid)=>{
        try {
          const pr = await fetch(`${API}/people/${pid}/stats` +
            `?stats=gameLog&group=pitching&season=${SEASON}&gameType=R`);
          if (!pr.ok) return;
          const pj = await pr.json();
          const splits = pj.stats?.[0]?.splits || [];
          const list = [];
          splits.forEach(s=>{
            const ip = parseFloat(s.stat?.inningsPitched);
            if (s.opponent?.id)
              list.push({ oppId:s.opponent.id, date:s.date, ip: isNaN(ip)?0:ip, stat:s.stat });
          });
          // list: all prior facings (oppId/date/ip/full stat line); season:
          // this pitcher's own season averages, used to color that facing's
          // stat line for the rematch thumbs up/down indicator
          facedMap[pid] = { list, season: pitcherSeasonAverages(splits) };
        } catch { /* leave unset */ }
      });
      // rematch/gauntlet boxes and the season-ERA number all read from this
      setFaced(facedMap);
      })();

      /* ── former team ("Homecoming Jinx"): has each probable spent 2+
         separate seasons pitching for the team he's facing today (a real
         tenure, not just a rental half-season or a mid-year rental the
         other way), with at least one of those seasons within the last two
         years (so a tenure that ended long ago no longer counts) —
         distinct from the in-season rematch above. Not called "revenge
         game": facing a former team is typically a bad outing for the
         pitcher, not a good one. ── */
      const formerTask = (async () => {
      const formerTeamMap = {};
      await mapPool([...pitcherIds], 6, async (pid)=>{
        try {
          const pr = await fetch(`${API}/people/${pid}/stats?stats=yearByYear&group=pitching&sportId=1`);
          if (!pr.ok) return;
          const pj = await pr.json();
          const splits = pj.stats?.[0]?.splits || [];
          const seasonsByTeam = {};   // team id -> Set(season)
          splits.forEach(s=>{
            if (!s.team?.id) return;
            const tid = Number(s.team.id);
            (seasonsByTeam[tid] = seasonsByTeam[tid] || new Set()).add(s.season);
          });
          const teams = new Set(Object.entries(seasonsByTeam)
            .filter(([,seasons])=>seasons.size>=2 && [...seasons].some(yr=>Number(yr)>=SEASON-2))
            .map(([tid])=>Number(tid)));
          formerTeamMap[pid] = teams;
        } catch { /* leave unset */ }
      });
      setFormerTeams(formerTeamMap);
      })();

      // the calendar is already interactive; this only marks the window
      // fully loaded once every indicator has published
      await Promise.all([comebackTask, facedTask, formerTask]);
      // the quality-adjusted batting score (the BAT number shown in a
      // game's modal) is NOT fetched here — it needs a further box-score
      // fetch per game plus a pitcher season-rate fetch per pitcher
      // involved, which is real cost worth paying only for a game the
      // viewer actually opens. See ensureBattingLine, called from
      // GameModal itself once a game is open.
      indicatorsLoadedForRef.current = start;
    } catch (e) {
      setErr(isNet(e.message) ? "Couldn't reach the MLB schedule service." : e.message);
    } finally { setBusy(false); }
  }, [start, westThreshold, minStreak]);
  useEffect(() => { load(); }, [load]);   // auto-load on open and when min streak changes

  // lazily fills in battingScoreMap for just the given team ids' last 5
  // games — called from GameModal once a game is actually opened (see
  // its own effect), not from the eager load() above. Skips a team
  // already fetched (or in flight) this window. Mirrors the same
  // quality-adjusted-batting-score math the calendar used to compute for
  // every team up front; now it's paid for only on demand.
  const ensureBattingLine = useCallback(async (teamIds, beforeTime) => {
    const need = (teamIds||[]).filter(tid => tid!=null && !battingLineFetchedRef.current.has(tid));
    if (!need.length) return;
    need.forEach(tid => battingLineFetchedRef.current.add(tid));
    try {
      const perTeamGames = {};   // tid -> last 5 prior finals, each {gamePk, time, side}
      const gamePkSet = new Set();
      need.forEach(tid => {
        const sched = (scheduleMap[tid]||[])
          .filter(s => s.isFinal && s.side && s.time < beforeTime)
          .sort((a,b) => b.time.localeCompare(a.time))
          .slice(0, 5);
        perTeamGames[tid] = sched;
        sched.forEach(s => gamePkSet.add(s.gamePk));
      });
      if (!gamePkSet.size) return;
      const boxCache = {};   // gamePk -> { away:[{pid,name,stat}], home:[...] }
      await mapPool([...gamePkSet], 4, async (gamePk) => {
        // every game reaching here came off the completed-games list
        const bx = await loadBoxscorePitchers(gamePk, true);
        if (bx) boxCache[gamePk] = bx;
      });
      const pitcherSeasonCache = {};   // pid -> { h9, bb9, hr9, doubles9, triples9 }
      const boxPids = new Set();
      Object.values(boxCache).forEach(bx => {
        (bx.away||[]).forEach(p=>boxPids.add(p.pid));
        (bx.home||[]).forEach(p=>boxPids.add(p.pid));
      });
      await mapPool([...boxPids], 4, async (pid) => {
        try {
          const r = await fetch(`${API}/people/${pid}/stats?stats=season&group=pitching&season=${SEASON}`);
          if (!r.ok) return;
          const j = await r.json();
          const stat = j.stats?.[0]?.splits?.[0]?.stat;
          const outs = ipToOuts(stat?.inningsPitched);
          if (!stat || !outs) return;   // e.g. a rookie with no innings logged yet
          pitcherSeasonCache[pid] = {
            h9: Number(stat.hits||0)*27/outs,
            bb9: Number(stat.baseOnBalls||0)*27/outs,
            k9: Number(stat.strikeOuts||0)*27/outs,
            hr9: Number(stat.homeRuns||0)*27/outs,
            doubles9: Number(stat.doubles||0)*27/outs,
            triples9: Number(stat.triples||0)*27/outs,
          };
        } catch { /* fall back to league-average below */ }
      });
      const newScores = {};   // tid -> { time -> score }
      // a team whose box score wasn't ready yet for one of its last 5 games
      // (the box score for a game that *just* went final can lag behind the
      // linescore hit count — which is why that game's HITS number already
      // shows while its SCORE doesn't) — tracked so that one gap doesn't
      // permanently blacklist the whole team's batting line for the rest of
      // the session; see battingLineFetchedRef handling below.
      const incomplete = new Set();
      need.forEach(tid => {
        perTeamGames[tid].forEach(({ gamePk, time, side }) => {
          const bx = boxCache[gamePk];
          const pitchers = bx?.[side==="home"?"away":"home"];
          if (!pitchers || !pitchers.length) { incomplete.add(tid); return; }
          let actual = 0, expected = 0;
          pitchers.forEach(p=>{
            const trueIP = ipToOuts(p.stat?.inningsPitched)/3;
            if (!trueIP) return;
            actual += combinedProduction(p.stat);
            expected += combinedProduction9(pitcherSeasonCache[p.pid] || LEAGUE_AVG_RATES) / 9 * trueIP;
          });
          const score = qualityScore(actual, expected);
          if (score!=null) (newScores[tid] = newScores[tid]||{})[time] = score;
          else incomplete.add(tid);
        });
      });
      setBattingScoreMap(prev => {
        const next = { ...prev };
        Object.entries(newScores).forEach(([tid, byTime]) => { next[tid] = { ...next[tid], ...byTime }; });
        return next;
      });
      // let a still-incomplete team retry the next time its modal opens,
      // rather than being marked "fetched" forever after this one partial pass
      incomplete.forEach(tid => battingLineFetchedRef.current.delete(tid));
    } catch {
      // a failed lazy fetch just leaves those teams' batting line blank —
      // let the viewer retry by reopening the modal, rather than looping
      need.forEach(tid => battingLineFetchedRef.current.delete(tid));
    }
  }, [scheduleMap]);

  // on mobile, scroll the calendar so today's column is in view on first load
  const calRef = useRef(null);
  const todayColRef = useRef(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !days || !days.length) return;
    if (window.innerWidth > 760) return;   // desktop shows all 7 columns already
    const container = calRef.current, el = todayColRef.current;
    if (container && el) {
      // center today's column within the horizontal scroller (no page scroll)
      container.scrollLeft = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      scrolledRef.current = true;
    }
  }, [days]);


  // ── copy today's whole slate as one image, tagged picks in red tags ──
  const [slateCopied, setSlateCopied] = useState(null);
  const copySlate = () => {
    try {
      const today = (days||[]).find(d=>d.date===start);
      const all = today ? today.games.filter(Boolean) : [];
      // only games that have a tag
      const games = all.filter(g => tagText(tags[g.gamePk]));
      if (!games.length) { setSlateCopied("empty"); setTimeout(()=>setSlateCopied(null),2000); return; }
      const scale = 3;
      // one card per tagged pick, styled like today's slate's calendar card:
      // teams stacked, time/FINAL top-right, the play (with its grade
      // indicator) anchored at a fixed indent shared by every card so the
      // indicator boxes line up in a column going down
      const CW = 300, RH = 64, GAP = 6, PADX = 12, HEAD = 40, PADB = 12;
      const W = PADX*2 + CW;
      const H = HEAD + games.length*RH + (games.length-1)*GAP + PADB;
      const cv = document.createElement("canvas");
      cv.width = W*scale; cv.height = H*scale;
      const x = cv.getContext("2d"); x.scale(scale, scale);
      x.fillStyle = "#E2E5EA"; x.fillRect(0,0,W,H);
      // header
      x.fillStyle = "#14181F"; x.font = "800 17px system-ui, sans-serif";
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillText("MLB", PADX, 22);
      x.fillStyle = "#525A66"; x.font = "10px ui-monospace, Menlo, monospace";
      x.textAlign = "right";
      x.fillText(prettyDay(start).toUpperCase(), PADX+CW, 22);
      // one card per tagged pick, matching the calendar card's own layout
      games.forEach((g,i)=>{
        const gx = PADX, gy = HEAD + i*(RH+GAP), midY = gy + RH/2;
        const resultTint = tagResultBg(tags[g.gamePk]);
        const final = g.isFinal && g.awayScore!=null && g.homeScore!=null;
        const aw = TEAM_ABBR[g.awayId]||"?", hm = TEAM_ABBR[g.homeId]||"?";
        const time = final ? "FINAL" : new Date(g.time).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
        const rr = 4;
        roundedRectPath(x, gx, gy, CW, RH, rr);
        x.fillStyle = "#20232A"; x.fill();
        if (resultTint) { x.fillStyle = resultTint; x.fill(); }
        x.strokeStyle = "#3A4250"; x.lineWidth = 1; x.stroke();
        // time / FINAL, top-right
        x.fillStyle = "#AEB7C4"; x.font = "9px ui-monospace, Menlo, monospace";
        x.textAlign = "right"; x.textBaseline = "alphabetic";
        x.fillText(final?"FINAL":time, gx+CW-10, gy+16);
        // teams stacked, left
        const row1Y = gy+26, row2Y = gy+46;
        x.textAlign = "left"; x.fillStyle = "#F2F4F7";
        x.font = "700 14px system-ui, sans-serif";
        x.fillText(aw, gx+12, row1Y);
        x.fillText(hm, gx+12, row2Y);
        // scores, right (if final)
        if (final) {
          x.textAlign = "right"; x.font = "700 14px ui-monospace, Menlo, monospace";
          x.fillStyle = g.awayScore>g.homeScore ? "#F2F4F7" : "#AEB7C4";
          x.fillText(String(g.awayScore), gx+CW-14, row1Y);
          x.fillStyle = g.homeScore>g.awayScore ? "#F2F4F7" : "#AEB7C4";
          x.fillText(String(g.homeScore), gx+CW-14, row2Y);
        }
        // logo icon in the gap between the team names and the play — same
        // spot on every card, going down the slate
        drawLogoIcon(x, gx + CW*0.25, midY, 24);
        // the play: grade indicator box + green code text, anchored at the
        // same fixed indent on every card so the indicators line up going down
        const tv = stripPlayPrefix(tagText(tags[g.gamePk]));
        const entry = tags[g.gamePk];
        const gradeResult = entry && typeof entry === "object" ? entry.result : null;
        const indentX = gx + CW*0.36;
        drawPlayIndicator(x, gradeResult, indentX, midY-7, 14);
        const rightLimit = final ? gx+CW-40 : gx+CW-10;
        drawGreenTag(x, tv, indentX+20, midY, rightLimit-(indentX+20), 13);
      });
      copyCanvas(cv, `mlb-picks-${start}.png`, setSlateCopied);
    } catch (e) {
      console.error("copySlate failed:", e);
      setSlateCopied("err"); setTimeout(()=>setSlateCopied(null),2000);
    }
  };

  /* which trends touch a game, attributed to the specific team they apply to */
  const computeGameTrends = (date, g) => {
    const echo = (echoes||[]).filter(e=>e.date===date &&
      (e.teamId===g.homeId || e.teamId===g.awayId));
    const cb = (comebacks||[]).filter(c=>c.next && c.next.date===date &&
      (c.teamId===g.homeId || c.teamId===g.awayId));
    const rematch = [];
    const rematchTier = {};                       // teamId -> 'strong' | 'weak'
    const rematchVerdict = {};                    // teamId -> 'up' | 'down' | 'even'
    const rematchCount = {};                      // teamId -> prior meetings vs today's opponent
    const checkRematch = (pid, teamId, oppId, pitcher, oppName) => {
      if (!pid) return;
      const entry = faced[pid];
      const facings = (entry?.list||[]).filter(x => Number(x.oppId)===Number(oppId) && x.date < date);
      if (!facings.length) return;
      const strong = facings.some(x => x.ip >= 4);
      rematch.push({ pitcher, pid, opp:oppName, oppId, teamId, strong });
      // keyed by the PITCHER'S OWN team, so the box lights up in that
      // team's row — not the opponent they're facing again
      rematchTier[teamId] = strong ? "strong" : "weak";
      // how many times he's already seen them — 2+ on BOTH sides is what
      // draws the neon-yellow outline around the pair of ERA numbers
      rematchCount[teamId] = facings.length;
      // most recent prior start against this opponent, graded on the H/BB/ER
      // majority (see rematchVerdictFor)
      const mostRecent = facings.reduce((a,b) => b.date > a.date ? b : a);
      rematchVerdict[teamId] = rematchVerdictFor(mostRecent.stat, entry.season);
    };
    checkRematch(g.awayPid, g.awayId, g.homeId, g.awayPname, g.homeName);
    checkRematch(g.homePid, g.homeId, g.awayId, g.homePname, g.awayName);

    // "Homecoming Jinx": this team's probable starter previously pitched FOR
    // the team he's facing today, recently enough and long enough to count
    // (see formerTeamMap above) — not just an in-season repeat matchup,
    // which is the rematch trend above.
    const formerTeam = [];
    const checkFormerTeam = (pid, teamId, oppId, pitcher, oppName) => {
      if (!pid) return;
      const teams = formerTeams[pid];
      if (!teams || !teams.has(Number(oppId))) return;
      formerTeam.push({ pitcher, pid, opp:oppName, oppId, teamId });
    };
    checkFormerTeam(g.awayPid, g.awayId, g.homeId, g.awayPname, g.homeName);
    checkFormerTeam(g.homePid, g.homeId, g.awayId, g.homePname, g.awayName);

    // this team's probable starter's season ERA — independent of any rematch
    const pitcherEra = (tid) => {
      const pid = tid===g.awayId ? g.awayPid : tid===g.homeId ? g.homePid : null;
      const era = pid ? faced[pid]?.season?.era : null;
      return era!=null ? era : null;
    };
    // the OTHER side's probable starter's ERA — who this team is actually
    // about to face today (used by the Shutout indicator below to judge
    // whether they're staring down a good pitcher).
    const oppPitcherEra = (tid) => {
      const pid = tid===g.awayId ? g.homePid : tid===g.homeId ? g.awayPid : null;
      const era = pid ? faced[pid]?.season?.era : null;
      return era!=null ? era : null;
    };

    // "the gauntlet": this team just came through a run of 3+ straight games
    // against a starter with a sub-3.00 ERA (2 in a row doesn't count — has
    // to be a genuine stretch) — looks strictly at the games BEFORE this one
    // (today's own opposing starter doesn't count toward it), same as the
    // other "yesterday"-style trend markers. Matches on this exact game's
    // gamePk (not just its date) so a doubleheader's second game correctly
    // finds its own first game as "the previous one," rather than an
    // ambiguous date match landing on either game. A game with no posted
    // starter yet, or an unknown ERA, simply breaks the run there, same
    // "actual games, not calendar days" logic as the other streaks. Exempt
    // from the "must have played yesterday" gate below — this is about a
    // stretch of games, not a single most-recent one.
    const gauntlet = [];
    [[g.awayId,g.awayName],[g.homeId,g.homeName]].forEach(([tid,tname])=>{
      const sched = scheduleMap[tid];
      if (!sched) return;
      const idx = sched.findIndex(s=>s.gamePk===g.gamePk);
      if (idx===-1) return;
      const qualifies = (i) => {
        const pid = sched[i]?.oppPid;
        const era = pid ? faced[pid]?.season?.era : null;
        return era!=null && era < 3.00;
      };
      let runLen = 0;
      for (let i=idx-1; i>=0 && qualifies(i); i--) runLen++;
      if (runLen>=3) gauntlet.push({ teamId:tid, team:tname, len:runLen });
    });

    // the specific game(s) immediately before this one in the team's real
    // schedule (using scheduleMap's sequential order, same idea as the
    // gauntlet lookup above) — NOT "the most recent completed game found
    // anywhere," which would keep matching the same old result across every
    // future game in the visible window whenever one or more games in
    // between haven't been played yet.
    const prevScheduledGames = (tid, count) => {
      const sched = scheduleMap[tid];
      if (!sched) return [];
      const idx = sched.findIndex(s=>s.gamePk===g.gamePk);
      if (idx===-1) return [];
      return sched.slice(Math.max(0,idx-count), idx).reverse();
    };
    // this team's game immediately before this one — only counts if that
    // specific game has actually been played (an unplayed game simply has
    // no entry in runsMap, so this correctly comes back empty rather than
    // reaching past it to some earlier result).
    const prevGameRuns = (tid) => {
      const prev = prevScheduledGames(tid, 1)[0];
      const runs = prev ? runsMap[tid]?.[prev.time] : null;
      return runs!=null ? runs : null;
    };
    const bigday = [];
    const aRuns = prevGameRuns(g.awayId), hRuns = prevGameRuns(g.homeId);
    if (aRuns>=10) bigday.push({ teamId:g.awayId, team:g.awayName, runs:aRuns });
    if (hRuns>=10) bigday.push({ teamId:g.homeId, team:g.homeName, runs:hRuns });

    // did this team score 0 runs in each of the two games immediately before
    // this one (same strict adjacency as bigDayStreak below)?
    const shutoutStreak = (tid) => {
      const [prev1, prev2] = prevScheduledGames(tid, 2);
      if (!prev1 || !prev2) return false;
      const r1 = runsMap[tid]?.[prev1.time], r2 = runsMap[tid]?.[prev2.time];
      return r1===0 && r2===0;
    };
    // the opposite extreme — got shut out last time out. A team can never
    // be both in the same game, so this shares the Big Day box (same slot,
    // just a different color) instead of needing a slot of its own. Unlike
    // Big Day, a single shutout only counts if they're now facing a good
    // pitcher (sub-3.50 ERA) — a shutout against a good arm isn't much of a
    // signal on its own; getting shut out in each of the last two games
    // regardless of today's pitcher is the other qualifying case.
    const shutout = [];
    if (aRuns===0 && ((oppPitcherEra(g.awayId)!=null && oppPitcherEra(g.awayId)<3.50) || shutoutStreak(g.awayId)))
      shutout.push({ teamId:g.awayId, team:g.awayName });
    if (hRuns===0 && ((oppPitcherEra(g.homeId)!=null && oppPitcherEra(g.homeId)<3.50) || shutoutStreak(g.homeId)))
      shutout.push({ teamId:g.homeId, team:g.homeName });
    const bigDayKind = (tid) =>
      bigday.some(b=>b.teamId===tid) ? "big" : shutout.some(s=>s.teamId===tid) ? "zero" : null;

    // did this team score 10+ runs in each of the two games immediately
    // before this one (same strict adjacency as above, not just "the last
    // two completed games found anywhere")?
    const bigDayStreak = (tid) => {
      const [prev1, prev2] = prevScheduledGames(tid, 2);
      if (!prev1 || !prev2) return false;
      const r1 = runsMap[tid]?.[prev1.time], r2 = runsMap[tid]?.[prev2.time];
      return r1>=10 && r2>=10;
    };

    // this team's last 5 games' quality-adjusted batting score (0-10) plus
    // the actual hit count, left-to-right oldest to most recent — feeds the
    // 5 batter boxes in the game modal. Scans by exact prior game start time
    // (not date) so an off-day doesn't leave a box blank and a doubleheader's
    // earlier game still counts as the later game's own "previous game"
    // instead of being skipped entirely; the actual values come from
    // battingScoreMap/hitsMap.
    //
    // only this team's NEXT still-to-be-played game shows the line at all —
    // any other, further-out future game just shows the "–" placeholder
    // (same look as still-loading) instead of repeating the same numbers on
    // every card in a homestand. As a game finishes, the team's "next game"
    // shifts forward (a later doubleheader leg today, or tomorrow's game)
    // and picks up the line there. Already-played/in-progress games are
    // unaffected. Goes by each game's own tracked status (isFinal/isLive),
    // not a wall-clock comparison — a doubleheader's early leg can already
    // be Final well before its late leg's own scheduled time arrives, and
    // the late leg is still that team's own "next game up" despite that.
    const hitsLine = (tid) => {
      const empty = [null,null,null,null,null].map(()=>({ score:null, hits:null, opp:null }));
      if (!g.isFinal && !g.isLive) {
        const sched = scheduleMap[tid];
        const nextUp = sched && sched.find(s => !s.isFinal);
        if (nextUp && nextUp.gamePk !== g.gamePk) return empty;
      }
      const m = hitsMap[tid];
      if (!m) return empty;
      const scores = battingScoreMap[tid] || {};
      const opps = oppMap[tid] || {};
      const priorTimes = Object.keys(m).filter(t => t < g.time).sort().reverse();
      const at = (i) => priorTimes[i]!=null
        ? { score: scores[priorTimes[i]] ?? null, hits: m[priorTimes[i]] ?? null, opp: opps[priorTimes[i]] ?? null }
        : { score:null, hits:null, opp:null };
      return [at(4), at(3), at(2), at(1), at(0)];
    };

    // most of these indicators are specifically claims about "yesterday" —
    // scored X runs, snapped a streak, flew cross-country overnight. If the
    // team had an off day, there's no "yesterday" for that claim to point
    // at, so none of them should light up. The Gauntlet (a multi-game
    // stretch) and Homecoming Jinx (roster history) aren't about yesterday
    // specifically, so they're exempt from this gate.
    const yesterday = addDays(date,-1);
    const playedYesterday = (tid) => (scheduleMap[tid]||[]).some(s=>s.date===yesterday && s.isFinal);
    const travelersY = (g.travelers||[]).filter(x=>playedYesterday(x.teamId));
    // TEMPORARY test indicator — shares the B2B travel box (see buildList)
    const grindersY = (g.grinders||[]).filter(x=>playedYesterday(x.teamId));
    const echoY = echo.filter(e=>playedYesterday(e.teamId));
    const cbY = cb.filter(c=>playedYesterday(c.teamId));
    const bigdayY = bigday.filter(b=>playedYesterday(b.teamId));
    const shutoutY = shutout.filter(s=>playedYesterday(s.teamId));

    // per-team keys for the 2x2 situational-trend grid
    const sideKeys = { [g.awayId]:new Set(), [g.homeId]:new Set() };
    const add = (tid, key) => { if (sideKeys[tid]) sideKeys[tid].add(key); };
    travelersY.forEach(x=>add(x.teamId, "travel"));
    grindersY.forEach(x=>add(x.teamId, "travel"));   // TEMPORARY
    echoY.forEach(e=>add(e.teamId, "echo"));
    cbY.forEach(c=>add(c.teamId, "late"));
    bigdayY.forEach(b=>add(b.teamId, "bigday"));
    shutoutY.forEach(s=>add(s.teamId, "bigday"));
    gauntlet.forEach(x=>add(x.teamId, "gauntlet"));
    formerTeam.forEach(x=>add(x.teamId, "formerTeam"));

    const any = travelersY.length>0 || echoY.length>0 || cbY.length>0 || rematch.length>0 || bigdayY.length>0 || shutoutY.length>0 || gauntlet.length>0 || formerTeam.length>0 || grindersY.length>0;
    return { travel:travelersY.length>0, travelers:travelersY, echo:echoY, cb:cbY, rematch, bigday:bigdayY, shutout:shutoutY, gauntlet, formerTeam, any,
      keysFor:(tid)=>sideKeys[tid] || new Set(),
      // TEMPORARY — which of the two conditions lit that team's B2B box, so
      // the hover title can say. Nothing else reads this.
      travelKind:(tid)=>{
        const gr = grindersY.find(x=>x.teamId===tid);
        return gr ? `TEST · extras last night (${gr.innings} inn), day game today` : null;
      },
      bigDayKind,
      rematchTier:(tid)=>rematchTier[tid] || null,
      rematchVerdict:(tid)=>rematchVerdict[tid] || null,
      rematchCount:(tid)=>rematchCount[tid] || 0,
      pitcherEra,
      bigDayStreak,
      shutoutStreak,
      hitsLine };
  };

  // computeGameTrends walks every trend list for one game and hands back a
  // bundle of closures, and it gets called for every visible game — and again
  // for every game of the open day, on every render. None of it depends on
  // the clock, so without a cache the 60-second `now` tick alone redid the
  // whole slate. The cache is rebuilt (identity changes) exactly when one of
  // the underlying data sets does, so a freshly-published indicator still
  // shows up immediately.
  // Cached per data generation: the moment any input identity changes, every
  // bundle built from the old one is stale, so the whole map is dropped and
  // refilled lazily. That keeps a newly-published indicator appearing at once
  // while a bare clock tick costs nothing.
  const trendCacheRef = useRef({ inputs:null, map:new Map() });
  const trendInputs = [echoes, comebacks, faced, formerTeams, runsMap, hitsMap,
    oppMap, scheduleMap, battingScoreMap, start, westThreshold];
  const prevInputs = trendCacheRef.current.inputs;
  if (!prevInputs || trendInputs.some((v,i) => v !== prevInputs[i]))
    trendCacheRef.current = { inputs:trendInputs, map:new Map() };

  const gameTrends = (date, g) => {
    const cache = trendCacheRef.current.map;
    const key = `${date}|${g.gamePk}`;
    if (cache.has(key)) return cache.get(key);
    const out = computeGameTrends(date, g);
    cache.set(key, out);
    return out;
  };

  // Every (game, team, indicator) hit across the loaded window, flattened so
  // the Research tab can filter by indicator without re-deriving anything.
  // Cheap to rebuild each render: gameTrends is already cached, so this is a
  // few hundred set lookups over data that's in hand.
  const indicatorHits = [];
  (days||[]).forEach(d => (d.games||[]).filter(Boolean).forEach(g => {
    const t = gameTrends(d.date, g);
    [[g.awayId, g.awayName], [g.homeId, g.homeName]].forEach(([tid, tname]) => {
      t.keysFor(tid).forEach(key => {
        indicatorHits.push({
          key, kind: key==="bigday" ? t.bigDayKind(tid) : null,
          date: d.date, gamePk: g.gamePk, teamId: tid, team: tname,
          abbr: TEAM_ABBR[tid] || "?",
          away: TEAM_ABBR[g.awayId] || "?", home: TEAM_ABBR[g.homeId] || "?",
          isHome: tid===g.homeId, time: g.time, isFinal: g.isFinal,
          awayScore: g.awayScore, homeScore: g.homeScore,
        });
      });
    });
  }));

  // published after indicatorHits so the Research tab sees a list built from
  // the same render's trend data; the trend inputs are in the dependency list
  // because a late-arriving indicator changes the hits without touching `days`
  useEffect(() => { if(onReady) onReady({ load, busy, copySlate, slateCopied, modalOpen: !!modal,
    showIndicators, setShowIndicators, anchor, setAnchor, indicatorHits, start });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, busy, onReady, slateCopied, days, tags, modal, showIndicators, anchor, start,
      echoes, comebacks, faced, formerTeams, runsMap, hitsMap, oppMap, scheduleMap]);

  return (
    <div>
      {err && <ErrBox>{err}</ErrBox>}

      {/* ── 7-day calendar; past columns aligned to today's matchups ── */}
      {days && (
        <div>
          <div className="ts-cal" ref={calRef} style={{ gap:5, paddingBottom:4 }}>
            {days.map(d=>{
              const isToday = d.date === start;
              const label = isToday ? "Today"
                : d.date===addDays(start,-1) ? "Yesterday"
                : d.date===addDays(start,-2) ? "2 days ago" : calDay(d.date).wd;
              return (
              <div key={d.date} ref={isToday?todayColRef:null} className="ts-cal-col" style={{ border:`1px solid ${isToday?C.ink:C.rule}`, borderRadius:3,
                overflow:"hidden" }}>
                <div style={{ padding:"5px 7px", borderBottom:`1px solid ${C.rule}`,
                  background:isToday?C.ink:C.card, display:"flex", alignItems:"baseline", gap:5 }}>
                  <span style={{ fontFamily:SANS, fontSize:14, fontWeight:700,
                    color:isToday?"#fff":C.ink }}>{calDay(d.date).md}</span>
                  <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:isToday?"rgba(255,255,255,0.7)":C.inkSoft }}>{label}</span>
                </div>
                <div style={{ padding:4, display:"flex", flexDirection:"column", gap:4 }}>
                  {d.games.length===0
                    ? <div className="ts-cell" style={{ height:CARD_H, display:"flex", alignItems:"center",
                        justifyContent:"center", fontFamily:SANS, fontSize:12, color:C.ruleDark }}>—</div>
                    : (() => {
                        const lineIdx = isToday
                          ? d.games.filter(g=>g && new Date(g.time) <= now).length : -1;
                        const dayGames = d.games.filter(Boolean);   // real games this day, in order
                        const dayTrends = dayGames.map(g=>gameTrends(d.date, g));
                        const cells = [];
                        d.games.forEach((g,i)=>{
                          if(i===lineIdx) cells.push(<NowLine key="nl"/>);
                          if(!g) cells.push(<div key={i} className="ts-cell" style={{ height:CARD_H, borderRadius:2,
                            border:`1px dashed ${C.rule}`, opacity:0.4, boxSizing:"border-box" }}/>);
                          else {
                            const di = dayGames.indexOf(g);
                            const t = dayTrends[di];   // reuse; already computed above
                            cells.push(<CalCard key={i} g={g} t={t} tag={tagText(tags[g.gamePk])}
                              showInd={showIndicators} now={now}
                              onOpen={()=>setModal({ date:d.date, idx:di })}/>);
                          }
                        });
                        if(lineIdx>=d.games.length) cells.push(<NowLine key="nl-end"/>);
                        return cells;
                      })()
                  }
                </div>
              </div>);
            })}
          </div>
          <div style={{ opacity: showIndicators ? 1 : 0.4, transition:"opacity 0.15s",
            marginTop:12 }}><Legend /></div>
        </div>
      )}

      {modal && (() => {
        // recomputed fresh on every render (not a frozen snapshot from
        // click-time) so state updates that land after the modal is
        // already open — like ensureBattingLine's lazy fetch resolving —
        // actually reach it.
        const openDay = days?.find(d => d.date===modal.date);
        const openGames = (openDay?.games||[]).filter(Boolean);
        const openTrends = openGames.map(g => gameTrends(modal.date, g));
        return <GameModal m={{ date:modal.date, games:openGames, trends:openTrends, idx:modal.idx }}
          tags={tags} setTag={setTag} now={now} onClose={()=>setModal(null)}
          ensureBattingLine={ensureBattingLine} />;
      })()}
    </div>
  );
}

function LegendRow({ s }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:6, width:"100%" }}>
      <span style={{ width:13, height:9, borderRadius:2, flexShrink:0, marginTop:3,
        background: s.outline ? "transparent" : s.color,
        boxShadow: s.outline ? `inset 0 0 0 1.5px ${s.color}` : "none" }} />
      <span style={{ display:"flex", flexDirection:"column", lineHeight:1.25, minWidth:0 }}>
        <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:C.ink }}>
          {s.label}{s.yesterday && "*"}</span>
        <span style={{ fontFamily:SANS, fontSize:10.5, color:C.inkSoft }}>{s.desc}</span>
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
      {/* Big Day and Shutout are the same box lighting up a different color,
          so they're bracketed together — two loose rows read as two slots. */}
      <div style={{ display:"flex", gap:7 }}>
        <span style={{ width:2, borderRadius:1, background:C.ruleDark, flexShrink:0 }} />
        <div style={{ display:"flex", flexDirection:"column", gap:6, minWidth:0 }}>
          {SHARED_BOX_ROWS.map(s => <LegendRow key={s.key+s.label} s={s} />)}
          <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.08em",
            textTransform:"uppercase", color:C.ruleDark }}>
            ↑ one box, two colors — a team can never be both
          </span>
        </div>
      </div>
      {TREND_SLOTS.slice(1).map(s => <LegendRow key={s.key} s={s} />)}
      <LegendRow s={DUEL_LEGEND_ENTRY} />
      <div style={{ fontFamily:SANS, fontSize:10, color:C.ruleDark, marginTop:2 }}>
        * Void if the team had an off day yesterday — these are all specifically
        claims about yesterday's game, so there's nothing for them to point at.
      </div>
    </div>
  );
}

/* box geometry — the situational-trend boxes are still real bordered boxes;
   the pitcher/batter numbers are plain text but keep this same slot width
   so everything still lines up under the PITCHER/BATTER headers. */
const BOX_W = 14, BOX_H = 13, BOX_GAP = 1.5;
const ERA_BOX_W = 26;   // "12.34" needs ~24px at this font, hits never do
const MAIN_H = 19;                         // a team's row height
const BASES_W = 26;                        // reserved for the live bases display — never shifts
/* A card and an empty slot MUST come out to the same height, or a column
   with holes in it drifts out of step with its neighbours — and because the
   error compounds per hole, a slate with several gaps ends up visibly
   ragged even though every game is in the correct grid cell. So the height
   is derived from its parts rather than eyeballed, and CalCard pins itself
   to it instead of merely setting a minimum. CARD_HEAD_H covers the
   time/FINAL + ERA-label line (font-size 8 at line-height 1.2 = 9.6). */
const CARD_HEAD_H = 10, CARD_PAD = 4, CARD_ROW_GAP = 2;
const CARD_H = CARD_HEAD_H + CARD_ROW_GAP + MAIN_H*2 + CARD_PAD*2 + 2;   // +2 = border

/* fixed situational-trend slots, rendered as a 1x5 row per team (away row on
   top, home row on bottom — matching the Game/Pitcher-Batter sections). add
   new trends here and every card + the legend adjust automatically. */
// `shortLabel` is what actually renders inside a modal TrendChip — narrow
// enough to fit without truncating. `label` stays the full name, still used
// by the homepage legend and calendar-card tooltips, which have room for it.
// entries marked yesterday:true are void if the team had an off day
// yesterday (see the "*" footnote the Legend renders below the list) —
// Gauntlet and Homecoming Jinx are the only two exempt from that gate.
const TREND_SLOTS = [
  { key:"bigday", color:C.bigday, label:"Big Day", shortLabel:"Big Day",
    desc:"Scored 10+ runs in their last game", yesterday:true },
  { key:"late",   color:C.late,   label:"Late go-ahead", shortLabel:"Late GA",
    desc:"Team never led at any point — not even mid-inning — until the 8th or later, yesterday", yesterday:true },
  { key:"gauntlet", color:C.gauntlet, label:"The Gauntlet", shortLabel:"Gauntlet",
    desc:"Just faced 3+ straight starters with a sub-3.00 ERA" },
  { key:"formerTeam", color:C.revenge, label:"Homecoming Jinx", shortLabel:"Jinx",
    desc:"Probable pitcher spent 2+ seasons on this team, at least one within the last 2 years — usually goes poorly for him" },
  { key:"echo",   color:C.echo,   label:"Streak echo", shortLabel:"Streak",
    desc:"Team just snapped a 10+ game win or loss streak yesterday", yesterday:true },
  { key:"travel", color:C.travel, label:"B2B travel", shortLabel:"B2B",
    desc:"West yesterday, East today on back-to-back days", yesterday:true },
];
// total rendered width of the trend-box strip — a fixed constant (the slot
// count never changes per-game), used to reserve matching blank space in
// the header row so the time/FINAL label's own right edge lines up with
// the trend boxes' right edge one row below.
const TRENDS_W = BOX_W*TREND_SLOTS.length + BOX_GAP*(TREND_SLOTS.length-1);

// shutout ("blanked, 0 runs last game") shares the Big Day box rather than
// getting a slot of its own — a team can never be both in the same game, so
// the one box just lights up a different color depending on which extreme
// happened. This swaps in that color/label wherever the "bigday" slot is
// about to render for a team whose last game was the zero-run kind.
const bigDaySlotFor = (kind) => kind==="zero"
  ? { key:"bigday", color:C.shutout, label:"Shutout", shortLabel:"Shutout",
      desc:"Shut out last game while facing a sub-3.50 ERA pitcher today, or shut out in each of the last two games",
      yesterday:true }
  : TREND_SLOTS.find(s=>s.key==="bigday");
// legend-only entry — the calendar/modal indicator grid stays the same 6
// boxes (see TRENDS_W above); this is just an extra row in the legend list
// so "what does the blue box mean" has an answer.
const SHUTOUT_LEGEND_ENTRY = bigDaySlotFor("zero");
// Big Day and its opposite-extreme twin Shutout are one box, so the legend
// renders them as a bracketed pair (see Legend) rather than as two rows that
// look like two separate slots; everything after them is a slot of its own.
const SHARED_BOX_ROWS = [TREND_SLOTS[0], SHUTOUT_LEGEND_ENTRY];
// legend-only, and not a trend box at all: the neon-yellow outline drawn
// around BOTH ERA numbers when each starter has already faced the lineup
// across from him 2+ times this season. `outline` renders the swatch as a
// ring instead of a filled chip, matching how it actually looks on a card.
const DUEL_LEGEND_ENTRY = { key:"duel", color:C.duel, outline:true,
  label:"Rematch duel",
  desc:"Both starters have already faced tonight's opponent 2+ times this season — one outline around both ERA numbers" };

/* a monospace font gives "." the same full character-cell width as a digit,
   which visibly wastes room in these small fixed-width number boxes (badly
   enough that the boldest one was overflowing its box by a couple of
   pixels). Splits a decimal string like "9.1" or "12.34" so the dot's own
   cell can be narrowed — but the "." glyph itself isn't drawn centered
   within its own cell (most fonts give it a lopsided side-bearing so it
   hugs the preceding digit), so text-align:center on a narrowed box still
   came out closer to the left digit. Draws a plain circle instead, sized
   and placed by hand: an empty inline-block with no explicit vertical-align
   has no baseline of its own, so its bottom margin edge sits exactly on the
   surrounding text's baseline — `bottom:0.03em` then lifts it from there to
   0.1em above baseline, matching where a real period's ink actually sits
   (measured via canvas text metrics at this font/weight). */
function TightDecimal({ text }) {
  const i = text.indexOf(".");
  if (i === -1) return text;
  return <>{text.slice(0,i)}<span style={{ display:"inline-block", position:"relative",
    bottom:"0.03em", width:"0.14em", height:"0.14em", margin:"0 0.09em",
    borderRadius:"50%", background:"currentColor" }} />{text.slice(i+1)}</>;
}

/* the pitcher's season ERA (unrounded past the hundredth — no border around
   it, just a soft highlight fill). If they've already faced this team this
   season, the fill grades that outing on hits/walks/earned runs: soft green
   when more of the three read good than bad, soft red when more read bad,
   soft blue when they split evenly or none of them said much either way
   (see rematchVerdictFor). No fill at all means no prior meeting. The text
   itself always stays its resting ink color, never tinted. */
function EraNum({ era, verdict, dark }) {
  const has = era != null;
  const bg = verdict==="up" ? (dark?C.darkSoftOver:C.softOver)
    : verdict==="down" ? (dark?C.darkSoftUnder:C.softUnder)
    : verdict==="even" ? (dark?C.darkSoftEven:C.softEven) : "transparent";
  const color = has ? (dark?C.darkText:C.ink) : (dark?C.darkTextSoft:C.ruleDark);
  return (
    <span title="Season ERA" style={{ width:ERA_BOX_W, flexShrink:0, textAlign:"center",
      fontFamily:MONO, fontSize:8, fontWeight:700, color, whiteSpace:"nowrap",
      background:bg, borderRadius:3, transition:"background 0.4s ease, color 0.4s ease" }}>{has ? <TightDecimal text={era.toFixed(2)} /> : "–"}</span>
  );
}

/* one of the team's last 5 games' quality-adjusted batting score (0-10, 5.0
   = exactly the times-on-base + total-bases less strikeouts production the
   pitching staff they faced that day would be expected to allow), with the
   game's actual
   hit count in a separate row underneath it (see BattingFive) — two rows of
   5 cells each, rather than 5 independently-sized stacked boxes, so all 5
   scores share one text baseline (and all 5 hit counts share another)
   regardless of the size tier a given slot is drawn at. No border, just a
   soft highlight fill on the score. Soft green at 7.0+ ("hot"), soft red at
   3.0 or below ("cold") — the text itself always stays its resting color,
   never tinted. The most recent game is drawn in the largest size; older
   games step down in two tiers. */
function BattingScoreCell({ score, size, emphasize }) {
  const has = score != null;
  const bg = has && score>=7.0 ? C.softOver : has && score<=3.0 ? C.softUnder : "transparent";
  // always solid black (well, near-black ink) when there's a real number —
  // legibility matters more here than dimming older games via color.
  const color = has ? C.ink : C.ruleDark;
  // "10.0" (the one 4-char case, at the very top of the scale) doesn't fit
  // this cell at this font size even with the dot tightened up — drop the
  // decimal just for that ceiling value rather than widen the cell.
  const label = has ? (score.toFixed(1)==="10.0" ? "10" : score.toFixed(1)) : "–";
  return (
    <span title={emphasize ? "Batting score, last game" : "Batting score"}
      style={{ flex:1, minWidth:0, textAlign:"center", whiteSpace:"nowrap",
        fontFamily:MONO, fontSize:size, fontWeight:emphasize?700:400, color,
        background:bg, borderRadius:3, padding:"2px 2px",
        transition:"background 0.4s ease, color 0.4s ease" }}>
      {has ? <TightDecimal text={label} /> : "–"}
    </span>
  );
}
function BattingHitsCell({ hits, size }) {
  return (
    <span title="Hits that game" style={{ flex:1, minWidth:0, textAlign:"center", whiteSpace:"nowrap",
      fontFamily:MONO, fontSize:size, color: hits!=null ? C.ink : C.ruleDark }}>
      {hits!=null ? hits : "–"}
    </span>
  );
}
// the opponent that particular game was played against, 3-letter abbreviation
// — one fixed small size across all 5 slots (unlike the score/hits rows,
// this is a label, not tiered data, so it doesn't need to step up in size).
function BattingOppCell({ oppId }) {
  const abbr = oppId!=null ? (TEAM_ABBR[oppId] || "") : "";
  return (
    <span title={abbr ? `vs ${abbr}` : undefined} style={{ flex:1, minWidth:0, textAlign:"center",
      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
      fontFamily:MONO, fontSize:8, letterSpacing:"0.03em", color:C.ruleDark }}>
      {abbr || " "}
    </span>
  );
}
// oldest → newest sizing tiers: games 4-5-back smallest, 2-3-back medium,
// most recent largest — applied to both the score and the hits row.
const BAT5_SCORE_SIZES = [9, 9, 10.5, 10.5, 13];
const BAT5_HITS_SIZES  = [7, 7, 7.5, 7.5, 9];
/* one team's last 5 games — an opponent-abbreviation row, a score row, and a
   hits row, oldest to newest — shown underneath its starting-pitcher box and
   above its lineup. alignItems:"baseline" on the score/hits rows is what
   actually keeps every slot level despite their different font sizes —
   differently-sized inline text still shares one baseline, unlike stacking
   whole differently-tall boxes and aligning their edges. */
function BattingFive({ games }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <div style={{ display:"flex", gap:3 }}>
        {games.map((gm,i) => <BattingOppCell key={i} oppId={gm.opp} />)}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
        {games.map((gm,i) => <BattingScoreCell key={i} score={gm.score}
          size={BAT5_SCORE_SIZES[i]} emphasize={i===games.length-1} />)}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
        {games.map((gm,i) => <BattingHitsCell key={i} hits={gm.hits} size={BAT5_HITS_SIZES[i]} />)}
      </div>
    </div>
  );
}

/* one situational-trend box: filled solid with its color when lit, dimmed
   neutral outline when not. `inner` draws a small marker on top (e.g. "!"
   for a team on a 10+ run back-to-back streak). */
function TrendBox({ present, color, title, inner, dark }) {
  return (
    <span title={title} style={{ position:"relative", width:BOX_W, height:BOX_H, borderRadius:2,
      flexShrink:0, background: present ? color : "transparent",
      boxShadow: present ? "none" : `inset 0 0 0 1.5px ${dark?C.darkOutline:C.inkSoft}`,
      opacity: present ? 1 : 0.45,
      transition:"background 0.4s ease, box-shadow 0.4s ease, opacity 0.4s ease",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      {present && inner && <span style={{ fontFamily:MONO, fontSize:9, fontWeight:800,
        color:"#fff", lineHeight:1 }}>{inner}</span>}
    </span>
  );
}

/* the game-modal version of TrendBox — same slot order/colors as the
   homepage schedule's grid, but wide enough to spell the label out instead
   of just lighting a colored square, since there's room here that the
   calendar card doesn't have. Flexible width so a team's 6 chips always
   span exactly its half of the indicator row, on any viewport. */
function TrendChip({ slot, present }) {
  return (
    // a fixed lineHeight, and a real (if color-matched/invisible) border in
    // both states, so an unlit chip takes up exactly the same box as a lit
    // one instead of collapsing down to just its padding.
    <span title={slot.desc} style={{ flex:1, minWidth:0, boxSizing:"border-box",
      fontFamily:MONO, fontSize:8, fontWeight:700, textAlign:"center", lineHeight:"12px",
      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
      padding:"3px 2px", borderRadius:3,
      background: present ? slot.color : "transparent",
      color: present ? "#fff" : C.ruleDark,
      border: `1px solid ${present ? slot.color : C.rule}` }}>
      {present ? slot.shortLabel : " "}
    </span>
  );
}

/* full-width row of this game's situational-trend indicators, split into
   the away team's 6 slots (left half) and the home team's 6 slots (right
   half) — together spanning the whole modal width, one continuous strip of
   12 chips lined up with the away/home columns below. */
function TrendIndicatorRow({ t, awayId, homeId }) {
  const half = (tid) => {
    const keys = t.keysFor(tid);
    const kind = t.bigDayKind(tid);
    return (
      <div style={{ display:"flex", gap:3, flex:1, minWidth:0 }}>
        {TREND_SLOTS.map(slot => {
          const s = slot.key==="bigday" ? bigDaySlotFor(kind) : slot;
          return <TrendChip key={slot.key} slot={s} present={keys.has(slot.key)} />;
        })}
      </div>
    );
  };
  return (
    <div style={{ display:"flex", gap:8, padding:"10px 18px 2px" }}>
      {half(awayId)}
      {half(homeId)}
    </div>
  );
}

function TeamLine({ abbr, score, hits, won, final, live, dark }) {
  const showScore = final || live;
  const ink = dark ? C.darkText : C.ink;
  const inkSoft = dark ? C.darkTextSoft : C.inkSoft;
  const ruleDark = dark ? C.darkTextSoft : C.ruleDark;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"24px 16px 14px", alignItems:"center", gap:6 }}>
      <span style={{ fontFamily:MONO, fontSize:13,
        fontWeight: final ? (won?800:400) : 600,
        color: final ? (won?ink:inkSoft) : ink }}>{abbr}</span>
      <span style={{ fontFamily:MONO, fontSize:13, textAlign:"center",
        fontWeight: final && won ? 800 : 400,
        color: final ? (won?ink:inkSoft) : showScore ? ink : ruleDark }}>{showScore ? score : ""}</span>
      <span style={{ fontFamily:MONO, fontSize:10, textAlign:"center", color:ruleDark }}>
        {showScore && hits!=null ? hits : ""}</span>
    </div>
  );
}

/* series shading — two pairs, two waves:
   wave 0 (current/past series):  light gray  ↔  white
   wave 1 (today's-slate series): dark charcoal ↔ lighter slate grey (a
   real dark theme, not just a darker tint — text/outlines on these two
   switch to their light equivalents, see the `dark` prop threaded through
   below); kept clearly different in lightness so the two are easy to
   tell apart at a glance */
/* 0=light-gray (leftovers even), 1=white (leftovers odd),
   2=dark-charcoal (today-series even), 3=lighter-slate-grey (today-series odd) */
const SERIES_SHADE = ["#EDEFF2", "#FFFFFF", "#20232A", "#2F3239"];
const isDarkShade = (shade) => shade===2 || shade===3;

/* the "current time" marker that rests in the gap between today's games */
function NowLine() {
  // sits between two cells without consuming row height: the negative vertical
  // margins cancel its own 2px plus the flex gap, so rows in today's column
  // stay aligned with every other column.
  return (
    <div aria-label="now" style={{ display:"flex", alignItems:"center", height:2,
      margin:"-3px 0", position:"relative", zIndex:1, pointerEvents:"none" }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:"#E5142B",
        flex:"0 0 auto", marginLeft:-2 }} />
      <span style={{ flex:1, height:2, background:"#E5142B" }} />
    </div>
  );
}

/* live-game status: inning on top, the mini three-base diamond in the
   middle, outs below — stacked top-to-bottom, docked next to the team lines. */
function LiveDiamond({ inningNum, inningState, outs, onFirst, onSecond, onThird, dark }) {
  if (inningNum == null) return null;
  const ink = dark ? C.darkText : C.ink;
  const arrow = inningState==="Bottom" || inningState==="End" ? "▼" : "▲";
  // diamonds as SVG polygons (not rotated CSS boxes) so all three bases are
  // drawn in one coordinate space — guarantees 2nd sits exactly centered
  // over 1st/3rd instead of relying on independently-positioned, separately
  // anti-aliased rotated elements to line up pixel-for-pixel.
  const diamond = (cx, cy, on) => {
    const r = 3.7;
    return <polygon points={`${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}`}
      fill={on ? ink : "none"} stroke={ink} strokeWidth="1.2" />;
  };
  return (
    <div style={{ flexShrink:0, width:BASES_W, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:2 }}>
      <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:ink, whiteSpace:"nowrap" }}>
        {arrow}{inningNum}</div>
      <svg width="22" height="18" viewBox="0 0 22 18">
        {diamond(11, 4.5, onSecond)}
        {diamond(4.5, 12, onThird)}
        {diamond(17.5, 12, onFirst)}
      </svg>
      <div style={{ display:"flex", gap:1.5 }}>
        {[0,1,2].map(i=>(
          <span key={i} style={{ width:4, height:4, borderRadius:"50%",
            background: outs!=null && i<outs ? ink : "transparent",
            border:`1.1px solid ${ink}` }} />
        ))}
      </div>
    </div>
  );
}

/* this team's probable starter's season ERA + rematch-verdict. The last-3-
   games batting trio that used to sit next to this lives in the game modal
   now, alongside that game's trend indicators. */
function pitcherBatterStats(t, tid) {
  return { era: t.pitcherEra(tid), verdict: t.rematchVerdict(tid) };
}
function PBBoxRow({ s, dark }) {
  return <EraNum era={s.era} verdict={s.verdict} dark={dark} />;
}

/* column 1 — Game: the two team lines, with a fixed-width slot next to the
   score reserved for the live bases display so nothing shifts when a game
   goes live. */
function GameSection({ g, aw, hm, awWon, hmWon, final, live, dark }) {
  return (
    <div style={{ display:"grid", gridTemplateRows:`${MAIN_H}px ${MAIN_H}px` }}>
      <div style={{ gridRow:1, display:"flex", alignItems:"center" }}>
        <TeamLine abbr={aw} score={g.awayScore} hits={g.awayHits} won={awWon} final={final} live={live} dark={dark} />
      </div>
      <div style={{ gridRow:2, display:"flex", alignItems:"center" }}>
        <TeamLine abbr={hm} score={g.homeScore} hits={g.homeHits} won={hmWon} final={final} live={live} dark={dark} />
      </div>
    </div>
  );
}

/* "ERA" column label, sized to sit centered directly over EraNum below. */
function PBHeaderLabels({ dark }) {
  return (
    <div style={{ width:ERA_BOX_W, textAlign:"center", fontFamily:MONO, fontSize:7, fontWeight:700,
      letterSpacing:"0.05em", color: dark?C.darkTextSoft:C.inkSoft }}>ERA</div>
  );
}

/* the merged pitcher/batter + trend-indicator column, right-aligned as one
   unit. This column is the row's only "auto" (stretchy) track besides the
   game column — whatever leftover width the two of them split keeps
   growing on the *outside* of this unit (between the bases display and the
   BAT numbers) since the whole unit is anchored to the right, so the ERA
   box stays tight against the first trend box regardless of viewport, and
   the trend boxes stay flush against the card's actual right wall instead
   of trailing off with blank space after them (this matters most on
   mobile, where the card is narrowest relative to its fixed-width content
   and that leftover space is largest). Big Day gets a "!" marker when the
   team scored 10+ runs in each of its last two games, on top of the box
   simply being lit for the one-game version. */
function StatsRow({ tid, t, dark }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
      <PBBoxRow s={pitcherBatterStats(t, tid)} dark={dark} />
      <span style={{ width:7, flexShrink:0 }} />
      <div style={{ display:"flex", alignItems:"center", gap:BOX_GAP }}>
        {TREND_SLOTS.map(slot=>{
          const kind = slot.key==="bigday" ? t.bigDayKind(tid) : null;
          const s = slot.key==="bigday" ? bigDaySlotFor(kind) : slot;
          const present = t.keysFor(tid).has(slot.key);
          // Shutout only earns "!" on a real 2+ game shutout streak, same as
          // Big Day earning it on a 2+ game 10-run streak — a single shutout
          // against a good pitcher today just lights the box plainly.
          const inner = slot.key!=="bigday" ? null
            : kind==="zero" ? (t.shutoutStreak(tid) ? "!" : null)
            : t.bigDayStreak(tid) ? "!" : null;
          // TEMPORARY: the B2B box is doubling as the extras-then-matinee test,
          // so its hover title says which condition lit it. Look only, no style.
          const title = !present ? undefined
            : slot.key==="travel" ? (t.travelKind?.(tid) || s.label)
            : s.label;
          return <TrendBox key={slot.key} present={present} color={s.color} inner={inner}
            title={title} dark={dark} />;
        })}
      </div>
    </div>
  );
}
function StatsAndTrends({ g, t, dark }) {
  // Both of tonight's starters are on at least their third look at the lineup
  // across from them. That's a property of the matchup, not of either team, so
  // it can't live in a per-team trend box — instead one outline stretches down
  // the ERA column to enclose BOTH numbers at once.
  //
  // Each StatsRow is right-aligned, so the ERA cell always sits a fixed
  // distance in from the right wall: the trend strip, then the 7px gap. The
  // overlay is placed off that same measurement (widened 2px a side so the
  // outline clears the digits) and spans the full two-row height.
  const duel = t.rematchCount(g.awayId)>=2 && t.rematchCount(g.homeId)>=2;
  return (
    <div style={{ display:"grid", gridTemplateRows:`${MAIN_H}px ${MAIN_H}px`,
      position:"relative" }}>
      <StatsRow tid={g.awayId} t={t} dark={dark} />
      <StatsRow tid={g.homeId} t={t} dark={dark} />
      {duel && (
        <span style={{ position:"absolute", top:1, bottom:1,
          right:TRENDS_W + 7 - 2, width:ERA_BOX_W + 4,
          borderRadius:3, pointerEvents:"none",
          boxShadow:`inset 0 0 0 1.5px ${C.duel}`,
          transition:"box-shadow 0.4s ease" }} />
      )}
    </div>
  );
}

/* header-row mirror of StatsRow: BAT/ERA labels, then a blank slot exactly
   TRENDS_W wide holding the time/FINAL/LIVE label right-aligned within it —
   same structure, same 7px gap, so this row's content lines up with the
   real numbers and trend boxes in the row below regardless of how wide
   this (also right-aligned, also "auto") column ends up being. */
function StatsHeaderRow({ dark, live, timeLabel }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
      <PBHeaderLabels dark={dark} />
      <span style={{ width:7, flexShrink:0 }} />
      <div style={{ width:TRENDS_W, display:"flex", alignItems:"center", justifyContent:"flex-end",
        gap:3, fontFamily:MONO, fontSize:8, lineHeight:1.2,
        color: live ? "#E5142B" : (dark?C.darkTextSoft:C.ruleDark), fontWeight: live ? 700 : 400 }}>
        {live && <span style={{ width:6, height:6, borderRadius:"50%", background:"#E5142B",
          flexShrink:0 }} />}
        {timeLabel}
      </div>
    </div>
  );
}

function CalCard({ g, t, tag, showInd=true, now, onOpen }) {
  const aw = TEAM_ABBR[g.awayId]||"?", hm = TEAM_ABBR[g.homeId]||"?";
  const time = new Date(g.time).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
  const final = g.isFinal && g.awayScore!=null && g.homeScore!=null;
  // MLB's API sometimes flips a game to "Live" a little ahead of its listed
  // start time — hold off on the LIVE badge (and the bases display) until
  // that time has actually passed, then defer entirely to the API.
  const live = g.isLive && !final && now.getTime() >= new Date(g.time).getTime();
  const awWon = final && g.awayScore > g.homeScore;
  const hmWon = final && g.homeScore > g.awayScore;
  const dark = isDarkShade(g.seriesShade);
  const bg = g.seriesShade!=null ? SERIES_SHADE[g.seriesShade] : "#fff";
  const tagInCorner = tag && showInd;        // indicators on → tag overlaps corner
  const tagInMarkers = tag && !showInd;      // indicators off → tag sits where markers were
  const bases = live && <LiveDiamond inningNum={g.inningNum} inningState={g.inningState} outs={g.outs}
    onFirst={g.onFirst} onSecond={g.onSecond} onThird={g.onThird} dark={dark} />;
  return (
    <div onClick={onOpen||undefined} className="ts-cell"
      role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e)=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault();onOpen();} } : undefined}
      style={{ border:`1px solid ${dark?C.darkBorder:C.rule}`, borderRadius:2, boxSizing:"border-box",
      height:CARD_H, padding:CARD_PAD, background:bg, overflow:"visible", position:"relative",
      cursor: onOpen ? "pointer" : "default" }}>
      {tagInCorner && (
        <div title={tag} style={{ position:"absolute", top:-4, left:-5, zIndex:3, maxWidth:"86%",
          background:"#F2657A", color:"#fff", border:"1px solid #D7263D", borderRadius:3,
          padding:"1px 5px", fontFamily:SANS, fontSize:9.5, fontWeight:700, lineHeight:1.25,
          boxShadow:"0 1px 3px rgba(120,0,20,0.3)", whiteSpace:"nowrap", overflow:"hidden",
          textOverflow:"ellipsis", transform:"rotate(-2deg)" }}>{tag}</div>
      )}
      {tagInMarkers && (
        <div title={tag} style={{ position:"absolute", right:6, top:"50%", zIndex:3, maxWidth:"64%",
          transform:"translateY(-50%) rotate(-2deg)",
          background:"#F2657A", color:"#fff", border:"1px solid #D7263D", borderRadius:3,
          padding:"1px 6px", fontFamily:SANS, fontSize:9.5, fontWeight:700, lineHeight:1.3,
          boxShadow:"0 1px 3px rgba(120,0,20,0.3)", whiteSpace:"nowrap", overflow:"hidden",
          textOverflow:"ellipsis" }}>{tag}</div>
      )}
      <div className="ts-card-grid" style={{ display:"grid",
        // the game column and the merged pitcher/batter+trends column are
        // both "auto" — CSS splits leftover row width EQUALLY between
        // tracks sharing that sizing function, and since the game column's
        // content is left-anchored while the merged column's content is
        // right-anchored (see StatsRow), that equal split lands as
        // matching growth on either side of the bases column, keeping it
        // centered — while every gap *inside* the merged column (ERA to
        // the trend boxes, trend boxes to the card's own right wall) stays
        // exactly fixed regardless of viewport, because that column's own
        // content doesn't shift internally, only its total width does.
        gridTemplateColumns: showInd ? `auto ${BASES_W}px auto` : `max-content ${BASES_W}px`,
        // pinned rather than "auto auto" so the card's height is the sum the
        // CARD_H constant says it is, whatever the header row happens to hold
        gridTemplateRows:`${CARD_HEAD_H}px ${MAIN_H*2}px`,
        columnGap:7, rowGap:CARD_ROW_GAP }}>
        <div style={{ gridColumn:1, gridRow:1 }} />
        {/* the live bases display gets its own column spanning both rows —
            from the FINAL/time row all the way down — instead of being
            squeezed into just the two team rows below it. */}
        <div style={{ gridColumn:2, gridRow:"1 / span 2", display:"flex",
          alignItems:"center", justifyContent:"center" }}>{bases}</div>
        {showInd ? (
          <div style={{ gridColumn:3, gridRow:1 }}>
            <StatsHeaderRow dark={dark} live={live} timeLabel={final ? "FINAL" : live ? "LIVE" : time} />
          </div>
        ) : (
          <div style={{ gridColumn:1, gridRow:1, fontFamily:MONO, fontSize:8, lineHeight:1.2,
            display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3,
            color: live ? "#E5142B" : (dark?C.darkTextSoft:C.ruleDark), fontWeight: live ? 700 : 400 }}>
            {live && <span style={{ width:6, height:6, borderRadius:"50%", background:"#E5142B",
              flexShrink:0 }} />}
            {final ? "FINAL" : live ? "LIVE" : time}
          </div>
        )}
        <div style={{ gridColumn:1, gridRow:2 }}>
          <GameSection g={g} aw={aw} hm={hm} awWon={awWon} hmWon={hmWon} final={final} live={live} dark={dark} />
        </div>
        {showInd && <div style={{ gridColumn:3, gridRow:2 }}><StatsAndTrends g={g} t={t} dark={dark} /></div>}
      </div>
    </div>
  );
}

/* ── game detail modal: probable pitchers, every prior matchup vs this team ── */
// colored stat line for a pitcher start, relative to this pitcher's own
// season averages (falls back to flat thresholds until a season average
// is available):
//  IP  black within 2 outs of their average outing · shorter red · longer green
//  H   black within 1.5 hits of the rate their season H/9 predicts for
//      this many outs · fewer green · more red
//  ER  black within 1.00 of season ERA (this game's ER as an ERA) · lower green · higher red
//  BB  black within 1.0 walk of the rate their season BB/9 predicts · fewer green · more red
//  K   black within 2 of the rate their season K/9 predicts · more green · fewer red
//
// laid out as a fixed equal-width column grid (not flowing text) so every
// stat sits in the same horizontal position on every row — a double-digit
// value never shifts the columns after it — and stretches to fill the row.
// 3 optional extra columns ("extra") hold the pitcher-vs-lineup quality
// score for this exact start, the opposing team's own batting score, and
// its raw hit count from the game right before this one — see PitcherBlock.
// every stat column (base 5, plus the 3 extra ones when present) gets an
// equal share of the row's width — only Date/Opp (sized by their callers)
// get special treatment; the stats themselves are all the same width.
const PLINE_COLS = "repeat(5, minmax(0,1fr))";
const PLINE_EXTRA_COLS = "repeat(3, minmax(0,1fr))";
// alternating column backgrounds (not row stripes) — each stat keeps the
// same faint tint in every row of the log, so your eye can track a single
// column (say, just K) straight down the list instead of losing it between
// rows. Continues from the header so the banding reads as one continuous
// column, not something that starts partway down.
const PLINE_COL_BG = [C.card, "transparent", C.card, "transparent", C.card, "transparent", C.card, "transparent"];
// same alternating idea, tuned for the dark pitcher box (a faint white wash
// instead of the light card tint)
const PLINE_COL_BG_DARK = ["rgba(255,255,255,0.05)", "transparent", "rgba(255,255,255,0.05)", "transparent",
  "rgba(255,255,255,0.05)", "transparent", "rgba(255,255,255,0.05)", "transparent"];
// Date and Opp (outside PLine's own grid, in PitcherSeasonModal) share this
// one flat tint — a distinct group from the alternating stat columns, not
// another entry in that alternation.
const PLINE_META_BG = "#EEF0F3";
// column labels for a PLine row, meant to be rendered ONCE above a list of
// PLine rows (values alone are ambiguous without a header in view).
function PLineHeader({ extra, leftBorder, dark }) {
  const colBg = dark ? PLINE_COL_BG_DARK : PLINE_COL_BG;
  const ruleColor = dark ? C.darkBorder : C.rule;
  return (
    <div style={{ display:"grid", gridTemplateColumns: extra ? `${PLINE_COLS} ${PLINE_EXTRA_COLS}` : PLINE_COLS,
      width:"100%", fontFamily:MONO, fontSize:9, letterSpacing:"0.06em",
      textTransform:"uppercase", color: dark?C.darkTextSoft:C.ruleDark, textAlign:"center" }}>
      {["IP","H","ER","BB","K"].map((l,i)=>(
        <span key={l} style={{ paddingTop:4, paddingBottom:4,
          background: colBg[i], borderLeft: (i>0 || leftBorder) ? `1px solid ${ruleColor}` : "none",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l}</span>
      ))}
      {extra && [["PIT","Pitcher score vs this start's lineup"],
                  ["OPP","Opponent's own batting score in their game right before this start"],
                  ["HIT","Opponent's hits in their game right before this start"]].map(([l,tip],j)=>(
        <span key={l} title={tip} style={{ paddingTop:4, paddingBottom:4,
          background: colBg[5+j], borderLeft:`1px solid ${ruleColor}`,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l}</span>
      ))}
    </div>
  );
}
function PLine({ s, season, extra, maxSize = 13, minSize = 7.5, leftBorder, dark }) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(maxSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = maxSize;
      el.style.fontSize = size + "px";
      const overflowing = () => Array.from(el.children).some(c => c.scrollWidth > c.clientWidth + 0.5);
      while (overflowing() && size > minSize) {
        size -= 0.5;
        el.style.fontSize = size + "px";
      }
      setFontSize(size);
    };
    fit();
    // a ResizeObserver on the element itself (not window resize) avoids a
    // mobile-rotation race where the resize event can fire before the new
    // viewport width has actually settled, leaving the text stuck oversized
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [s, season, extra, maxSize, minSize]);
  const st = s.stat || {};
  // a start with no innings pitched yet (the synthetic "upcoming game" row —
  // see PitcherSeasonModal) has nothing real to color; show flat dashes
  // instead of running it through pitcherLineColors (which would read its
  // all-zero/undefined fields as real, unusually good numbers).
  const played = st.inningsPitched != null;
  const neutralCol = dark ? C.darkTextSoft : C.ruleDark;
  const { ipCol, hCol, erCol, bbCol, kCol } = played
    ? pitcherLineColors(st, season, dark)
    : { ipCol:neutralCol, hCol:neutralCol, erCol:neutralCol, bbCol:neutralCol, kCol:neutralCol };
  const v = (x) => x==null ? "–" : x;

  // bg left undefined means "use this column's own alternating tint"
  // (PLINE_COL_BG) — only the "similar situation" highlight below overrides
  // it with something else.
  const cells = [
    [played ? v(st.inningsPitched) : "–", ipCol],
    [played ? v(st.hits)           : "–", hCol],
    [played ? v(st.earnedRuns)     : "–", erCol],
    [played ? v(st.baseOnBalls)    : "–", bbCol],
    [played ? v(st.strikeOuts)     : "–", kCol],
  ];
  if (extra) {
    // "…" while that piece is still loading, "–" once loading finished but
    // found nothing (e.g. no prior game on record) — same convention used
    // everywhere else in the app. Whole-number scores (including the 0/10
    // clamp bounds) drop the trailing ".0" — "10" reads cleaner than "10.0".
    const fmtScore = (v) => { const r = Math.round(v*10)/10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
    const num = (v) => v===undefined ? "…" : v==null ? "–" : fmtScore(v);
    const hits = extra.priorHits===undefined ? "…" : extra.priorHits==null ? "–" : String(extra.priorHits);
    const pColor = extra.pitcherScore==null ? (C.inkSoft)
      : extra.pitcherScore>=7 ? C.over : extra.pitcherScore<=3 ? C.under : C.ink;
    // "similar situation" softly highlights the opponent-score and
    // opponent-hits cells independently — either can light up on its own,
    // it doesn't take both matching the game being previewed. Never touches
    // the pitcher score cell or IP/H/ER/BB/K. See PitcherSeasonModal.
    cells.push([num(extra.pitcherScore), pColor]);
    cells.push([num(extra.priorScore), C.ink, extra.highlightScore ? C.softEven : undefined]);
    cells.push([hits, C.ink, extra.highlightHits ? C.softEven : undefined]);
  }
  return (
    <div ref={ref} style={{ display:"grid",
      gridTemplateColumns: extra ? `${PLINE_COLS} ${PLINE_EXTRA_COLS}` : PLINE_COLS,
      width:"100%", fontSize, textAlign:"center" }}>
      {cells.map(([txt,c,bg],i)=>{
        const background = bg ?? (dark ? PLINE_COL_BG_DARK[i] : PLINE_COL_BG[i]);
        return (
        <span key={i} style={{ display:"block", color:c, whiteSpace:"nowrap", overflow:"hidden",
          background, borderLeft: (i>0 || leftBorder) ? `1px solid ${dark?C.darkBorder:C.rule}` : "none",
          paddingTop:5, paddingBottom:5, marginTop:-5, marginBottom:-5 }}>{txt}</span>
        );
      })}
    </div>
  );
}

// full season game-by-game log for a pitcher (most recent first)
async function loadPitcherSeason(pid) {
  if (!pid) return [];
  try {
    const r = await fetch(`${API}/people/${pid}/stats?stats=gameLog&group=pitching&season=${SEASON}&gameType=R`);
    if (!r.ok) return [];
    const j = await r.json();
    const splits = j.stats?.[0]?.splits || [];
    return splits.slice().sort((a,b)=>b.date.localeCompare(a.date));
  } catch { return []; }
}

// a pitcher's prior starts vs a specific opponent this season (before `date`)
// — powers the colored IP/H/ER/BB/K history shown in the starting-pitcher
// box, only fetched once that box is actually on screen (see PitcherBlock).
async function loadPitcherVs(pid, oppId, date) {
  if (!pid) return null;
  try {
    const r = await fetch(`${API}/people/${pid}/stats?stats=gameLog&group=pitching&season=${SEASON}&gameType=R`);
    if (!r.ok) return null;
    const j = await r.json();
    const splits = (j.stats?.[0]?.splits||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const prior = splits.filter(s=>s.date < date);
    // Number(...) on both sides — the opponent id can come back as a string
    // in some API responses, which would silently fail a strict === match
    // and make a real rematch look like it never happened
    return { vs: prior.filter(s=>Number(s.opponent?.id)===Number(oppId)), season: pitcherSeasonAverages(prior) };
  } catch { return null; }
}

function PitcherSeasonModal({ pid, name, onClose, upcoming }) {
  const [log, setLog] = useState(undefined);
  useEffect(() => {
    let alive = true;
    loadPitcherSeason(pid).then(r=>{ if(alive) setLog(r); });
    return () => { alive = false; };
  }, [pid]);

  // the game this pitcher is actually lined up for (from PitcherBlock, which
  // only exists for a not-yet-played game) tacked onto the front of the log
  // as a placeholder row — no line to show yet, but its "opponent's last
  // game" context can still be pulled just like any other start. Skipped if
  // the real gameLog already has an entry for that date (e.g. it's since
  // been played and posted).
  const displayLog = useMemo(() => {
    if (!log) return log;
    if (!upcoming?.teamId || !upcoming?.date) return log;
    if (log.some(s => s.date === upcoming.date)) return log;
    const placeholder = { date: upcoming.date, opponent: { id: upcoming.teamId }, stat: {}, isUpcoming: true };
    return [placeholder, ...log].sort((a,b) => b.date.localeCompare(a.date));
  }, [log, upcoming]);

  // per-opponent-team season hitting rates (the baseline each start's pitcher
  // score below is judged against) and, per start, how that opponent was
  // hitting in the game right before this one — same "hot or cold bats"
  // context PitcherBlock shows for a single opponent, generalized here across
  // every team this pitcher has faced all season (plus the upcoming game,
  // if any — see displayLog above).
  const [oppRatesMap, setOppRatesMap] = useState({});
  const [priorCtxMap, setPriorCtxMap] = useState({});
  useEffect(() => {
    if (!displayLog || !displayLog.length) return;
    let alive = true;
    const oppIds = Array.from(new Set(displayLog.map(s=>s.opponent?.id).filter(id=>id!=null)));
    mapPool(oppIds, 3, async (id) => [id, await loadTeamSeasonHitting(id)]).then(results => {
      if (!alive) return;
      const map = {};
      results.forEach(([id, rates]) => { map[id] = rates; });
      setOppRatesMap(map);
    });
    mapPool(displayLog, 3, async (s) => [s.date, s.opponent?.id!=null ? await loadPriorGameContext(s.opponent.id, s.date) : null])
      .then(results => {
        if (!alive) return;
        const map = {};
        results.forEach(([date, ctx]) => { map[date] = ctx || { score:null, hits:null }; });
        setPriorCtxMap(map);
      });
    return () => { alive = false; };
  }, [displayLog]);

  const tot = useMemo(() => {
    if (!log || !log.length) return null;
    const sum = (k)=>log.reduce((s,g)=>s+(Number(g.stat[k])||0),0);
    const ipOuts = log.reduce((s,g)=>s+ipToOuts(g.stat.inningsPitched), 0);
    const ip = `${Math.floor(ipOuts/3)}.${ipOuts%3}`;
    const er = sum("earnedRuns");
    const era = ipOuts>0 ? ((er*27)/ipOuts).toFixed(2) : "—";
    return { gs:log.length, ip, k:sum("strikeOuts"), bb:sum("baseOnBalls"), h:sum("hits"), er, era };
  }, [log]);
  // season averages for coloring each start's line relative to this pitcher's own pace
  const seasonAvg = useMemo(() => pitcherSeasonAverages(log), [log]);

  // count starts per opponent (including the upcoming one) so a repeat
  // matchup can be flagged in the log
  const oppCounts = useMemo(() => {
    const m = {};
    (displayLog||[]).forEach(s=>{ const id = s.opponent?.id; if (id!=null) m[id] = (m[id]||0)+1; });
    return m;
  }, [displayLog]);

  // the situation this pitcher is actually walking into today: the upcoming
  // opponent's own batting score + hits in their game right before this one.
  // Any past start whose own opponent-score lands within ±1 of that gets its
  // score cell highlighted; independently, any start whose own opponent-hits
  // lands within ±1 gets its hits cell highlighted — one can light up
  // without the other, they're graded separately, not as a pair.
  const refCtx = upcoming?.date ? priorCtxMap[upcoming.date] : null;
  const scoreSimilar = (ctx) => refCtx?.score!=null && ctx?.score!=null && Math.abs(ctx.score-refCtx.score)<=1;
  const hitsSimilar = (ctx) => refCtx?.hits!=null && ctx?.hits!=null && Math.abs(ctx.hits-refCtx.hits)<=1;

  return (
    <div onClick={e=>{ e.stopPropagation(); onClose(); }} style={{ position:"fixed", inset:0, zIndex:60,
      background:"rgba(20,24,31,0.55)", display:"flex", alignItems:"flex-start",
      justifyContent:"center", padding:"max(12px, env(safe-area-inset-top)) 12px 12px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.paper,
        border:`1px solid ${C.ink}`, borderRadius:6, maxWidth:680, width:"100%",
        margin:"12px 0 40px", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"14px 18px", borderBottom:`2px solid ${C.ink}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.14em",
              textTransform:"uppercase", color:C.inkSoft }}>{SEASON} game log</div>
            <div style={{ fontFamily:SANS, fontSize:18, fontWeight:800 }}>{name}</div>
          </div>
          <button onClick={onClose} style={{ border:`1px solid ${C.rule}`, background:"#fff",
            borderRadius:2, fontFamily:MONO, fontSize:13, padding:"4px 10px", cursor:"pointer" }}>✕</button>
        </div>

        {tot && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",
            borderBottom:`1px solid ${C.rule}`, background:C.card }}>
            {[["GS",tot.gs],["IP",tot.ip],["ERA",tot.era],["K",tot.k],["BB",tot.bb],["H",tot.h]].map(([l,v])=>(
              <div key={l} style={{ padding:"8px 10px", borderRight:`1px solid ${C.rule}` }}>
                <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.08em",
                  textTransform:"uppercase", color:C.inkSoft }}>{l}</div>
                <div style={{ fontFamily:MONO, fontSize:15, fontWeight:700 }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding:"8px 0 14px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"38px 32px minmax(0,1fr)",
            padding:"4px 12px", alignItems:"baseline" }}>
            <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.06em",
              textTransform:"uppercase", color:C.ruleDark, background:PLINE_META_BG,
              paddingTop:4, paddingBottom:4 }}>Date</span>
            <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.06em",
              textTransform:"uppercase", color:C.ruleDark, background:PLINE_META_BG,
              borderLeft:`1px solid ${C.rule}`, paddingLeft:6, paddingTop:4, paddingBottom:4 }}>Opp</span>
            <PLineHeader extra leftBorder />
          </div>
          {log===undefined && <div style={{ padding:"10px 16px", fontFamily:MONO, fontSize:12, color:C.inkSoft }}>Loading…</div>}
          {log && log.length===0 && !displayLog?.length && <div style={{ padding:"10px 16px", fontFamily:SANS, fontSize:13, color:C.inkSoft }}>No {SEASON} starts found.</div>}
          {displayLog && displayLog.map((s,i)=>{
            const repeatOpp = s.opponent?.id!=null && oppCounts[s.opponent.id] > 1;
            const oppId = s.opponent?.id;
            const oppRates = oppId!=null ? oppRatesMap[oppId] : null;
            const pitcherScore = s.isUpcoming ? null
              : oppRates===undefined ? undefined : pitcherScoreForStart(s.stat, oppRates);
            const ctx = priorCtxMap[s.date];
            const highlightScore = !s.isUpcoming && scoreSimilar(ctx);
            const highlightHits = !s.isUpcoming && hitsSimilar(ctx);
            const metaBg = s.isUpcoming ? "rgba(22,162,223,0.14)" : PLINE_META_BG;
            return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"38px 32px minmax(0,1fr)",
              padding:"5px 12px", borderTop:`1px solid #EEF0F2`, alignItems:"baseline" }}>
              <span title={s.isUpcoming ? "Upcoming — not played yet" : undefined} style={{ fontFamily:MONO, fontSize:11,
                color: s.isUpcoming ? C.rematch : C.inkSoft, fontWeight: s.isUpcoming ? 700 : 400,
                background: metaBg, paddingTop:5, paddingBottom:5, marginTop:-5, marginBottom:-5 }}>{calDay(s.date).md}</span>
              <span style={{ fontFamily:MONO, fontSize:11,
                background: metaBg, borderLeft:`1px solid ${C.rule}`, paddingLeft:6,
                paddingTop:5, paddingBottom:5, marginTop:-5, marginBottom:-5 }}>
                <span style={{ display:"inline-block", width:"fit-content",
                  color: repeatOpp ? C.rematch : C.inkSoft,
                  fontWeight: repeatOpp ? 800 : 400,
                  background: repeatOpp ? "rgba(22,162,223,0.20)" : "transparent",
                  border: repeatOpp ? `1px solid ${C.rematch}` : "1px solid transparent",
                  borderRadius: repeatOpp ? 3 : 0, padding: repeatOpp ? "1px 4px" : 0 }}>{
                  TEAM_ABBR[s.opponent?.id] || s.opponent?.abbreviation
                  || s.opponent?.name?.split(" ").slice(-1)[0] || "—"}</span>
              </span>
              <span style={{ fontFamily:MONO, minWidth:0 }}><PLine s={s} season={seasonAvg} maxSize={12.5} leftBorder extra={{
                pitcherScore, priorScore: ctx?.score, priorHits: ctx?.hits, highlightScore, highlightHits }} /></span>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// pitcher name + matchup + season ERA, styled for the dark starting-pitcher
// box — click the name to check their full season log (which highlights
// this exact rematch, if any) in PitcherSeasonModal.
function PitcherBlock({ name, pid, vsName, era, oppTeamId, date, bare }) {
  const [showLog, setShowLog] = useState(false);
  // this season's prior starts vs this exact opponent, if any — fetched
  // only while this box is actually on screen (i.e. once a game's modal
  // is open), same as the added-pitcher's own era fetch below.
  const [info, setInfo] = useState(undefined);   // { vs:[...], season } | null
  useEffect(() => {
    let alive = true;
    if (!pid || !oppTeamId || !date) {
      Promise.resolve().then(() => { if (alive) setInfo(undefined); });
      return () => { alive = false; };
    }
    loadPitcherVs(pid, oppTeamId, date).then(r => { if (alive) setInfo(r); });
    return () => { alive = false; };
  }, [pid, oppTeamId, date]);

  const oppAbbr = TEAM_ABBR[oppTeamId] || vsName;
  const nameEl = !name ? <span style={{ color:C.darkTextSoft }}>TBD</span> : pid ? (
    <button onClick={()=>setShowLog(true)} title={`${name} — ${SEASON} game log`}
      style={{ font:"inherit", fontWeight:700, color:C.darkText, cursor:"pointer",
        border:"none", background:"transparent", padding:0,
        textDecoration:"underline", textDecorationColor:C.darkText, textUnderlineOffset:2 }}>{name}</button>
  ) : <span style={{ color:C.darkText }}>{name}</span>;
  const badge = <ConfirmBadge confirmed={!!name} color={C.darkTextSoft}
    title={name ? "Probable starter confirmed" : "Probable starter not yet announced"} />;
  const eraEl = name && (
    <span style={{ fontFamily:MONO, fontSize:15, fontWeight:700, color:C.darkText, whiteSpace:"nowrap" }}>
      {era!=null ? era.toFixed(2) : "–"}</span>
  );

  return (
    <div style={ bare ? {} : { borderTop:`1px solid ${C.darkBorder}`, padding:"12px 0" }}>
      {/* wide layout: one row, name+vs-team on the left (truncates as a
          single unit rather than wrapping — a wrapped second line here used
          to run straight into whatever sits below it), badge+era right */}
      <div className="ts-pitcher-head-wide" style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8 }}>
        <div style={{ fontFamily:SANS, fontSize:15, fontWeight:700, minWidth:0,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {nameEl}
          <span style={{ fontFamily:MONO, fontSize:11, color:C.darkTextSoft, fontWeight:400 }}>
            {"  vs "}{vsName}</span>
        </div>
        <span style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {badge}{eraEl}
        </span>
      </div>

      {/* narrow layout: name (+ badge) on its own row; "vs ABB" + ERA below */}
      <div className="ts-pitcher-head-narrow">
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8 }}>
          <div style={{ fontFamily:SANS, fontSize:15, fontWeight:700, minWidth:0,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{nameEl}</div>
          {badge}
        </div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8, marginTop:2 }}>
          <span style={{ fontFamily:MONO, fontSize:11, color:C.darkTextSoft, fontWeight:400 }}>
            vs {oppAbbr}</span>
          {eraEl}
        </div>
      </div>

      {!name && (
        <div style={{ fontFamily:SANS, fontSize:13, color:C.darkTextSoft, marginTop:4 }}>
          No probable starter posted yet.</div>
      )}

      {/* prior starts vs this opponent this season, color-coded the same
          way the season log modal colors them — only shown when there's
          actual history, and always with clear room below the header row
          so nothing overlaps it. */}
      {name && info?.vs?.length>0 && (
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", gap:8, alignItems:"baseline" }}>
            <span style={{ width:34, flexShrink:0 }} />
            <span style={{ flex:"1 1 auto", minWidth:0 }}><PLineHeader dark /></span>
          </div>
          {info.vs.map((s,i)=>(
            <div key={i} style={{ display:"flex", gap:8, alignItems:"baseline" }}>
              <span style={{ fontFamily:MONO, fontSize:10.5, color:C.darkTextSoft, width:34, flexShrink:0 }}>
                {calDay(s.date).md}</span>
              <span style={{ flex:"1 1 auto", minWidth:0 }}>
                <PLine s={s} season={info.season} maxSize={12} dark /></span>
            </div>
          ))}
        </div>
      )}

      {showLog && <PitcherSeasonModal pid={pid} name={name} onClose={()=>setShowLog(false)}
        upcoming={oppTeamId && date ? { teamId:oppTeamId, date } : null} />}
    </div>
  );
}

// one pitcher's line in the game's box score — name opens the same season
// game-log modal as everywhere else.
function PitcherStatLine({ p }) {
  const [showLog, setShowLog] = useState(false);
  // same season-average context the season game-log modal colors its rows
  // against, so this game's line and that modal agree on what's good/bad.
  const [season, setSeason] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPitcherSeason(p.pid).then(log => { if (alive) setSeason(pitcherSeasonAverages(log)); });
    return () => { alive = false; };
  }, [p.pid]);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, minWidth:0 }}>
        <button onClick={()=>setShowLog(true)} title={`${p.name} — ${SEASON} game log`}
          style={{ font:"inherit", fontFamily:SANS, fontSize:13, fontWeight:700, color:C.darkText,
            cursor:"pointer", border:"none", background:"transparent", padding:0,
            textDecoration:"underline", textDecorationColor:C.darkText, textUnderlineOffset:2,
            textAlign:"left", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            minWidth:0, flexShrink:1 }}>{p.name}</button>
        {/* season ERA, box-score style — shown pre-game, live, and final
            alike (as soon as it's loaded). Pinned to the right edge of
            the pitching box, in line with the name. */}
        {season?.era!=null && (
          <span style={{ fontFamily:MONO, fontSize:11, color:C.darkTextSoft, flexShrink:0, marginLeft:"auto" }}>
            {season.era.toFixed(2)} ERA
          </span>
        )}
      </div>
      <div style={{ marginTop:2 }}>
        <PLine s={{ stat:p.stat }} season={season} maxSize={13} dark />
      </div>
      {showLog && <PitcherSeasonModal pid={p.pid} name={p.name} onClose={()=>setShowLog(false)} />}
    </div>
  );
}

/* ════════════════════════ PROP ANALYZER ════════════════════════ */
function PropAnalyzer({ injected = null }) {
  const [name, setName] = useState("");
  const [statKey, setStatKey] = useState("hits");
  const [line, setLine] = useState("1.5");
  const [sampleN, setSampleN] = useState("20");   // "5"|"10"|"15"|"20"|"month"|"season"
  const [roster, setRoster] = useState(null);
  const [games, setGames] = useState(null);
  const [resolved, setResolved] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const loadRoster = useCallback(async () => {
    if (roster) return roster;
    const r = await fetch(`${API}/sports/1/players?season=${SEASON}`);
    if (!r.ok) throw new Error(`roster ${r.status}`);
    const j = await r.json();
    const people = j.people || [];
    setRoster(people);
    return people;
  }, [roster]);

  const analyzeLive = useCallback(async (override) => {
    const rawName = typeof override === "string" ? override : (override?.name ?? name);
    const rawStat = (override && typeof override === "object" && override.stat) ? override.stat : statKey;
    setErr(""); setGames(null); setResolved(""); setBusy(true);
    try {
      const people = await loadRoster();
      const q = rawName.trim().toLowerCase();
      if (!q) throw new Error("Enter a player name.");
      const hits = people.filter(p=>(p.fullName||"").toLowerCase().includes(q));
      if (!hits.length) throw new Error(`No ${SEASON} MLB player matched "${rawName}".`);
      const player = hits[0];
      const r = await fetch(`${API}/people/${player.id}/stats?stats=gameLog&group=hitting&season=${SEASON}&gameType=R`);
      if (!r.ok) throw new Error(`game log ${r.status}`);
      const j = await r.json();
      const splits = j.stats?.[0]?.splits || [];
      if (!splits.length) throw new Error(`No ${SEASON} game logs for ${player.fullName}.`);
      const rows = splits.map(s=>({ date:s.date, opp:s.opponent?.abbreviation||"",
        value:valOf(s.stat, rawStat) })).sort((a,b)=>a.date.localeCompare(b.date));
      setResolved(player.fullName); setGames(rows);
    } catch (e) {
      setErr(isNet(e.message)
        ? "Couldn't reach the MLB data service. This works from a normal browser tab in your own app."
        : e.message);
    } finally { setBusy(false); }
  }, [name, statKey, loadRoster]);

  // clicking a stat fills name + stat and runs immediately
  useEffect(() => {
    if (injected && injected.name) {
      setName(injected.name);
      if (injected.stat) setStatKey(injected.stat);
      analyzeLive({ name:injected.name, stat:injected.stat });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injected?.ts]);

  const analysis = useMemo(() => {
    if (!games?.length) return null;
    const L = parseFloat(line);
    let recent, sampleLabel;
    if (sampleN === "season") { recent = games; sampleLabel = "Season"; }
    else if (sampleN === "month") {
      const mo = String(games[games.length-1].date).slice(0,7);
      const m = games.filter(g=>String(g.date).startsWith(mo));
      recent = m.length ? m : games; sampleLabel = "This month";
    } else { const n=Number(sampleN); recent = games.slice(-n); sampleLabel = `Last ${n}`; }
    const avg = a => a.reduce((s,g)=>s+g.value,0)/a.length;
    const clears = g => g.value > L;
    const hitN = recent.filter(clears).length;
    let streak = 0;
    for (let i=games.length-1;i>=0;i--){ if(clears(games[i])) streak++; else break; }
    const recentAvg = avg(recent);
    return { L, recent, recentAvg, seasonAvg:avg(games), hitN,
      hitRate:hitN/recent.length, streak, sampleLabel, edge:recentAvg-L };
  }, [games, line, sampleN]);

  const statLabel = (HIT_STATS.find(s=>s[0]===statKey)||[statKey,statKey])[1];

  return (
    <div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end", marginBottom:14 }}>
        <Field label="Player"><input style={{ ...inputStyle, minWidth:150 }} value={name}
          placeholder="e.g. Aaron Judge"
          onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") analyzeLive(); }} /></Field>
        <Field label="Stat"><select style={{ ...inputStyle, minWidth:120 }} value={statKey}
          onChange={e=>setStatKey(e.target.value)}>
          {HIT_STATS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Line"><input style={{ ...inputStyle, width:70 }} value={line}
          inputMode="decimal" onChange={e=>setLine(e.target.value)} /></Field>
        <Field label="Sample"><select style={{ ...inputStyle, width:120 }} value={sampleN}
          onChange={e=>setSampleN(e.target.value)}>
          <option value="5">Last 5</option><option value="10">Last 10</option>
          <option value="15">Last 15</option><option value="20">Last 20</option>
          <option value="month">This month</option><option value="season">Season</option></select></Field>
        <button onClick={()=>analyzeLive()} disabled={busy} style={{ padding:"8px 16px",
          border:`1px solid ${C.ink}`, borderRadius:2, background:busy?C.rule:C.ink, color:"#fff",
          fontFamily:MONO, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase",
          cursor:busy?"default":"pointer" }}>{busy?"…":"Analyze"}</button>
      </div>

      {err && <ErrBox>{err}</ErrBox>}

      {analysis && (
        <div style={{ border:`1px solid ${C.ruleDark}`, borderRadius:3, background:C.card, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.rule}`,
            display:"flex", justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:8 }}>
            <span style={{ fontFamily:SANS, fontWeight:700, fontSize:16 }}>{resolved}</span>
            <span style={{ fontFamily:MONO, fontSize:12, color:C.inkSoft, textTransform:"uppercase",
              letterSpacing:"0.08em" }}>over {analysis.L} {statLabel}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",
            borderBottom:`1px solid ${C.rule}` }}>
            {[[`${analysis.sampleLabel} avg`, analysis.recentAvg.toFixed(2), `season ${analysis.seasonAvg.toFixed(2)}`, C.ink],
              ["Edge vs line", `${analysis.edge>=0?"+":""}${analysis.edge.toFixed(2)}`, analysis.edge>=0?"form beats line":"line beats form", analysis.edge>=0?C.over:C.under],
              ["Hit rate", `${Math.round(analysis.hitRate*100)}%`, `${analysis.hitN}/${analysis.recent.length} cleared`, analysis.hitRate>=0.6?C.over:analysis.hitRate<=0.4?C.under:C.ink],
              ["Streak", analysis.streak, `game${analysis.streak===1?"":"s"} over`, analysis.streak>=3?C.over:C.ink],
            ].map(([lab,val,sub,col],i)=>(
              <div key={i} style={{ padding:"10px 14px", borderRight:`1px solid ${C.rule}` }}>
                <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.08em",
                  textTransform:"uppercase", color:C.inkSoft }}>{lab}</div>
                <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:col, marginTop:2 }}>{val}</div>
                <div style={{ fontFamily:MONO, fontSize:10, color:C.ruleDark, marginTop:1 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:"16px 12px 8px" }}>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
              color:C.inkSoft, padding:"0 6px 8px" }}>Game-by-game · bar clears line = over</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={analysis.recent.map(g=>({ name:String(g.date).slice(5), value:g.value,
                clears:g.value>analysis.L }))} margin={{ top:4, right:16, bottom:4, left:-18 }}>
                <XAxis dataKey="name" tick={{ fontFamily:MONO, fontSize:9, fill:C.inkSoft }}
                  axisLine={{ stroke:C.rule }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontFamily:MONO, fontSize:10, fill:C.inkSoft }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill:"rgba(0,0,0,0.04)" }}
                  contentStyle={{ fontFamily:MONO, fontSize:11, borderRadius:2, border:`1px solid ${C.rule}` }} />
                <Bar dataKey="value" radius={[2,2,0,0]}>
                  {analysis.recent.map((g,i)=>(
                    <Cell key={i} fill={g.value>analysis.L ? C.over : C.under} />
                  ))}
                </Bar>
                <ReferenceLine y={analysis.L} stroke={C.ink} strokeWidth={1.5} strokeDasharray="4 3"
                  label={{ value:`line ${analysis.L}`, position:"right", fontFamily:MONO, fontSize:10, fill:C.ink }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function PropModal({ injected, onClose }) {
  return (
    <div onClick={e=>{ e.stopPropagation(); onClose(); }} style={{ position:"fixed", inset:0, zIndex:60,
      background:"rgba(20,24,31,0.55)", display:"flex", alignItems:"flex-start",
      justifyContent:"center", padding:"max(12px, env(safe-area-inset-top)) 12px 12px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.paper,
        border:`1px solid ${C.ink}`, borderRadius:6, maxWidth:600, width:"100%",
        margin:"12px 0 40px", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"14px 18px", borderBottom:`2px solid ${C.ink}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <span style={{ fontFamily:SANS, fontWeight:700, fontSize:16 }}>Prop Lookup</span>
          <button onClick={onClose} style={{ border:`1px solid ${C.rule}`, background:"#fff",
            borderRadius:2, fontFamily:MONO, fontSize:13, padding:"4px 10px", cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:"14px 18px 20px" }}>
          <PropAnalyzer injected={injected} />
        </div>
      </div>
    </div>
  );
}

/* ─────────── shared loaders for the unified game modal ─────────── */

// last-5 H / TB / HRR + this-month AVG for one batter (date = game date)
async function loadBatterTrend(id, date) {
  try {
    const r = await fetch(`${API}/people/${id}/stats?stats=gameLog&group=hitting&season=${SEASON}&gameType=R`);
    if (!r.ok) return { h:[], tb:[], hrr:[], avg:null };
    const j = await r.json();
    const splits = (j.stats?.[0]?.splits||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const last5 = splits.slice(-5);
    const month = date.slice(0,7);
    let h=0, ab=0;
    splits.filter(s=>(s.date||"").startsWith(month)).forEach(s=>{
      h+=Number(s.stat.hits)||0; ab+=Number(s.stat.atBats)||0;
    });
    return {
      h:   last5.map(s=>valOf(s.stat,"hits")),
      tb:  last5.map(s=>valOf(s.stat,"totalBases")),
      hrr: last5.map(s=>valOf(s.stat,"hits+runs+rbi")),
      avg: ab>0 ? (h/ab).toFixed(3).replace(/^0/,"") : null,
    };
  } catch { return { h:[], tb:[], hrr:[], avg:null }; }
}

// resolve a team's starting nine: confirmed lineup, else last completed game's order
async function loadLineup(game, side, date) {
  const lp = game.lineups?.[side+"Players"];
  if (lp && lp.length) {
    // live/finished games can list the same player twice (mid-game
    // substitution bookkeeping) — keep only each player's first appearance
    // so the lineup never shows duplicate rows.
    const seen = new Set();
    const unique = lp.filter(p => seen.has(p.id) ? false : (seen.add(p.id), true));
    return { source:"confirmed",
      players: unique.slice(0,9).map((p,i)=>({ id:p.id, name:p.fullName, order:i+1 })) };
  }
  const teamId = game.teams[side].team.id;
  const back = addDays(date,-14);
  try {
    const sr = await fetch(`${API}/schedule?sportId=1&teamId=${teamId}&startDate=${back}&endDate=${addDays(date,-1)}&gameType=R`);
    const sj = await sr.json();
    const prev = (sj.dates||[]).flatMap(d=>d.games||[])
      .filter(g=>g.status?.abstractGameState==="Final")
      .sort((a,b)=>a.gameDate.localeCompare(b.gameDate));
    const last = prev[prev.length-1];
    if (!last) return { source:"none", players:[] };
    const br = await fetch(`${API}/game/${last.gamePk}/boxscore`);
    const bj = await br.json();
    const which = last.teams.home.team.id===teamId ? "home" : "away";
    const t = bj.teams[which];
    // battingOrder on each player is "SO0" (slot, sub#00 = started that slot);
    // filter to starters only so a mid-game substitution doesn't bump the
    // original starter out of the projected lineup.
    const starters = Object.values(t.players||{})
      .filter(p=>typeof p.battingOrder==="string" && p.battingOrder.endsWith("00"))
      .sort((a,b)=>a.battingOrder.localeCompare(b.battingOrder));
    const players = starters.slice(0,9).map((p,i)=>({
      id:p.person.id, name:p.person.fullName, order:i+1 }));
    return { source:"projected", players };
  } catch { return { source:"none", players:[] }; }
}

// a team's season-long hitting output, converted to a "per team-game" rate
// — used the same way a pitcher's own season H9/BB9/HR9 rates judge a
// batting performance, just flipped to judge a PITCHER's start against the
// lineup he faced instead of a team's game against the pitcher it faced.
async function loadTeamSeasonHitting(teamId) {
  if (!teamId) return null;
  try {
    const r = await fetch(`${API}/teams/${teamId}/stats?stats=season&group=hitting&season=${SEASON}`);
    if (!r.ok) return null;
    const j = await r.json();
    const stat = j.stats?.[0]?.splits?.[0]?.stat;
    const gp = Number(stat?.gamesPlayed)||0;
    if (!stat || !gp) return null;
    return {
      h9: Number(stat.hits||0)/gp,
      bb9: Number(stat.baseOnBalls||0)/gp,
      k9: Number(stat.strikeOuts||0)/gp,
      hr9: Number(stat.homeRuns||0)/gp,
      doubles9: Number(stat.doubles||0)/gp,
      triples9: Number(stat.triples||0)/gp,
    };
  } catch { return null; }
}
// a pitcher's own season per-9 rates — same fetch the calendar's batting
// score already does per box score to judge a hitting performance against
// that specific pitcher's real quality, not just a flat league-average
// stand-in. Cached at module scope (a pitcher's season line doesn't change
// mid-session) since loadPriorGameContext calls this once per pitcher who
// appeared in every prior game across a whole season log.
const pitcherSeasonRateCache = {};   // pid -> { h9, bb9, k9, hr9, doubles9, triples9 } | null
async function loadPitcherSeasonRates(pid) {
  if (!pid) return null;
  if (pid in pitcherSeasonRateCache) return pitcherSeasonRateCache[pid];
  try {
    const r = await fetch(`${API}/people/${pid}/stats?stats=season&group=pitching&season=${SEASON}`);
    if (!r.ok) return (pitcherSeasonRateCache[pid] = null);
    const j = await r.json();
    const stat = j.stats?.[0]?.splits?.[0]?.stat;
    const outs = ipToOuts(stat?.inningsPitched);
    if (!stat || !outs) return (pitcherSeasonRateCache[pid] = null);   // e.g. a rookie with no innings logged yet
    return (pitcherSeasonRateCache[pid] = {
      h9: Number(stat.hits||0)*27/outs,
      bb9: Number(stat.baseOnBalls||0)*27/outs,
      k9: Number(stat.strikeOuts||0)*27/outs,
      hr9: Number(stat.homeRuns||0)*27/outs,
      doubles9: Number(stat.doubles||0)*27/outs,
      triples9: Number(stat.triples||0)*27/outs,
    });
  } catch { return null; }
}
// how a single start graded against the lineup a pitcher actually faced —
// the mirror image of the batting score: 5.0 is exactly what that lineup's
// own season rates predict a league-average pitcher allows them; higher is
// a pitcher who allowed LESS than that (invert:true — see qualityScore).
function pitcherScoreForStart(stat, oppRates) {
  const trueIP = ipToOuts(stat?.inningsPitched)/3;
  if (!trueIP) return null;
  return qualityScore(combinedProduction(stat),
    combinedProduction9(oppRates || LEAGUE_AVG_RATES)/9*trueIP, true);
}
// this team's most recent completed game before `beforeDate` — its own
// quality-adjusted batting score (a plain league-average baseline here,
// since digging up THAT game's own opposing pitchers' season rates would
// mean yet another round of fetches) and raw hits, giving "how hot or cold
// were the bats coming into this start" context next to a pitcher's game log.
async function loadPriorGameContext(teamId, beforeDate) {
  try {
    // 25 days back — comfortably covers the ~4-day All-Star break and any
    // rare rainout pileup, so a real prior game isn't missed just because
    // the search window was too tight
    const back = addDays(beforeDate, -25);
    const sr = await fetch(`${API}/schedule?sportId=1&teamId=${teamId}&startDate=${back}` +
      `&endDate=${addDays(beforeDate,-1)}&gameType=R&hydrate=linescore`);
    if (!sr.ok) return null;
    const sj = await sr.json();
    const prev = (sj.dates||[]).flatMap(d=>d.games||[])
      .filter(g=>g.status?.abstractGameState==="Final")
      .sort((a,b)=>a.gameDate.localeCompare(b.gameDate));
    const last = prev[prev.length-1];
    if (!last) return null;
    // Number(...) on both sides — teamId can come in as a string when this
    // is called with a gameLog entry's opponent.id (PitcherSeasonModal's
    // historical rows), which would otherwise silently fail this match and
    // read the wrong side's hits/pitchers on every single one of them
    const side = Number(last.teams.home.team.id)===Number(teamId) ? "home" : "away";
    const hits = Number(last.linescore?.teams?.[side]?.hits);
    const bx = await loadBoxscorePitchers(last.gamePk);
    const pitchers = bx?.[side==="home"?"away":"home"];
    let score = null;
    if (pitchers && pitchers.length) {
      // each pitcher's own season rates, same baseline the calendar's own
      // batting score judges against — not just a flat league-average
      // stand-in, so this number means the same thing in both places
      const rates = await Promise.all(pitchers.map(p=>loadPitcherSeasonRates(p.pid)));
      let actual = 0, expected = 0;
      pitchers.forEach((p,i)=>{
        const trueIP = ipToOuts(p.stat?.inningsPitched)/3;
        if (!trueIP) return;
        actual += combinedProduction(p.stat);
        expected += combinedProduction9(rates[i] || LEAGUE_AVG_RATES)/9*trueIP;
      });
      score = qualityScore(actual, expected);
    }
    return { hits: isNaN(hits)?null:hits, score };
  } catch { return null; }
}

// season head-to-head summary between two teams
// full per-inning line score for a finished game
async function loadLineScore(gamePk) {
  if (!gamePk) return null;
  try {
    const r = await fetch(`${API}/game/${gamePk}/linescore`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.innings || !j.innings.length) return null;
    return j;
  } catch { return null; }
}

// every pitcher who has appeared in this game so far, in order, with their
// current line (live games update as it goes; finished games are final).
// A FINAL game's box score is frozen, so it's worth keeping — arrowing back
// and forth through a day's games otherwise re-fetches the same one every
// time. Callers pass `settled` only for games that have actually finished; a
// live game is never cached, since its line is still moving.
const boxscorePitcherCache = {};   // gamePk -> parsed box
async function loadBoxscorePitchers(gamePk, settled=false) {
  if (!gamePk) return null;
  if (settled && boxscorePitcherCache[gamePk]) return boxscorePitcherCache[gamePk];
  try {
    const r = await fetch(`${API}/game/${gamePk}/boxscore`);
    if (!r.ok) return null;
    const j = await r.json();
    // the box score's own pitchers list can repeat an id (e.g. a pitcher
    // tracked across multiple mid-inning defensive shuffles) — dedupe so
    // each pitcher gets exactly one line.
    const side = (teamObj) => {
      const seen = new Set();
      return (teamObj?.pitchers || []).filter(pid => seen.has(pid) ? false : (seen.add(pid), true)).map(pid => {
        const p = teamObj.players?.[`ID${pid}`];
        const stat = p?.stats?.pitching;
        if (!p || !stat || stat.inningsPitched == null) return null;
        return { pid, name: p.person?.fullName, stat };
      }).filter(Boolean);
    };
    const out = { away: side(j.teams?.away), home: side(j.teams?.home) };
    if (settled) boxscorePitcherCache[gamePk] = out;
    return out;
  } catch { return null; }
}

/* Every MLB team-season a player logged, as "teamId:season" keys. Two players
   sharing one of these keys were on the same club in the same year — actual
   teammates — which is what the Homecoming Jinx lineup highlight keys off.
   Cached per person: a career history can't change mid-session. */
const teamSeasonCache = {};
async function loadTeamSeasons(personId, group) {
  if (!personId) return null;
  const key = `${personId}:${group}`;
  if (key in teamSeasonCache) return teamSeasonCache[key];
  try {
    const r = await fetch(`${API}/people/${personId}/stats` +
      `?stats=yearByYear&group=${group}&sportId=1`);
    if (!r.ok) return (teamSeasonCache[key] = null);
    const j = await r.json();
    const out = new Set();
    (j.stats?.[0]?.splits || []).forEach(s => {
      if (s.team?.id != null && s.season != null) out.add(`${s.team.id}:${s.season}`);
    });
    return (teamSeasonCache[key] = out);
  } catch { return (teamSeasonCache[key] = null); }
}

/* Which hitters in a lineup once shared a clubhouse with the pitcher they are
   about to face. Takes one entry per side — { key, pitcherId, players } — and
   returns { [key]: Set(playerId) }, so both lineups are marked against their
   own opposing starter in a single pass.

   Only ever called from an open modal: a career history per hitter is far too
   many requests to spend on a calendar the viewer is only scanning. Both sides
   run together and loadTeamSeasons caches per player, so arrowing through a
   series re-uses nearly everything it already fetched. */
async function loadTeammateMarks(pairs) {
  const out = {};
  await Promise.all(pairs.map(async ({ key, pitcherId, players }) => {
    if (!pitcherId || !players?.length) return;
    const pitcherSeasons = await loadTeamSeasons(pitcherId, "pitching");
    if (!pitcherSeasons?.size) return;
    const mates = new Set();
    await mapPool(players, 4, async (pl) => {
      const seasons = await loadTeamSeasons(pl.id, "hitting");
      if (seasons && [...seasons].some(k => pitcherSeasons.has(k))) mates.add(pl.id);
    });
    out[key] = mates;
  }));
  return out;
}

async function loadH2H(aId, bId) {
  const r = await fetch(`${API}/schedule?sportId=1&season=${SEASON}&gameType=R&teamId=${aId}&hydrate=linescore`);
  if (!r.ok) throw new Error(`schedule ${r.status}`);
  const j = await r.json();
  const games = (j.dates||[]).flatMap(d=>d.games||[])
    .filter(g=>g.teams.home.team.id===bId || g.teams.away.team.id===bId)
    .sort((x,y)=>x.gameDate.localeCompare(y.gameDate));
  let aw=0,bw=0,upcoming=0;
  const meetings = [];
  games.forEach(g=>{
    const aHome = g.teams.home.team.id===aId;
    const aSide = aHome?"home":"away", bSide = aHome?"away":"home";
    const aS=g.teams[aSide].score, bS=g.teams[bSide].score;
    const aHits=g.linescore?.teams?.[aSide]?.hits, bHits=g.linescore?.teams?.[bSide]?.hits;
    if (g.status?.abstractGameState==="Final" && aS!=null && bS!=null) {
      if (aS>bS) aw++; else if (bS>aS) bw++;
      meetings.push({ date: g.officialDate || g.gameDate.slice(0,10),
        aScore:aS, bScore:bS, aHits:aHits||0, bHits:bHits||0 });
    } else upcoming++;
  });
  meetings.reverse();   // most recent meeting first
  const played = aw+bw;
  return { aw,bw,upcoming,played,meetings };
}

// a batter's all-time (career) line vs a specific pitcher, one aggregated
// split across every season they've ever faced each other — `vsPlayer`
// returns a separate split PER season instead, which would only surface
// whichever single season happens to land first in the response.
async function loadBatterVs(batterId, pitcherId) {
  if (!batterId || !pitcherId) return null;
  try {
    const r = await fetch(`${API}/people/${batterId}/stats` +
      `?stats=vsPlayerTotal&opposingPlayerId=${pitcherId}&group=hitting&gameType=R`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.stats?.[0]?.splits?.[0]?.stat || null;
  } catch { return null; }
}

/* one team's column: lineup of 9 hitters, then its starting pitcher block below */
// condensed — these 4 stat columns only need to fit 1-2 digits / a .000 avg,
// and this whole row already has to share a narrow panel with its mirrored
// away/home twin, so keep them as tight as possible to leave the hitter's
// name the most room (see the vs-pitcher name/stat split in TeamPanel below,
// where these columns sit fixed to the right of a horizontally-scrollable
// name strip rather than in a single grid together).
const VS_STAT_COLS = "20px 16px 16px 32px";   // AB H HR AVG
function TeamPanel({ lineup, oppName, pitcherName, pitcherId, era, battingLine, onStat, oppPitcherName, oppPitcherId, oppTeamId, date, showBoxPitching, boxPitchers, col, mates, added, setAdded, oppAdded }) {
  // a hitter who once shared a clubhouse with the starter he's facing today
  const wasMate = (id) => !!mates?.has(id);
  const MATE_TITLE = "Played a season alongside today's opposing starter";
  const canVs = !!oppPitcherId && !!oppPitcherName;
  // the manually-added "bulk pitcher" (see AddPitcherBlock) is controlled
  // here, not inside that component, so it can also unlock its own
  // "vs [name]" lineup tab below.
  // `added` is the extra pitcher on THIS panel's own staff — he shows up in
  // the pitcher box above, alongside the starter. `oppAdded` is the one the
  // other side added, i.e. the arm THIS lineup would actually have to bat
  // against, which is what the "vs …" tab below is built from. Lining a
  // staff's own hitters up against their own reliever was the bug.
  // null = neither tab open, nothing shown yet — tapping a tab opens it,
  // tapping the already-open tab closes it again (accordion, not a toggle
  // between two always-visible views). Only the batting lineup collapses
  // like this; the starting-pitcher/box-score pitching block above it is
  // always shown regardless of `view`.
  const [rawView, setView] = useState(null);      // null | "last5" | "vssp" | "vsadded"
  const [vsData, setVsData] = useState({});       // batterId -> stat | null, vs the opposing starter
  const [vsLoading, setVsLoading] = useState(false);
  const [vsDataAdded, setVsDataAdded] = useState({});   // { pid, data:{batterId->stat|null} } vs the opposing added pitcher
  const [vsLoadingAdded, setVsLoadingAdded] = useState(false);

  // the other side dropping their extra pitcher takes this tab with it, so
  // fall back to closed rather than leaving a dead view selected
  const oppAddedId = oppAdded?.id || null;
  const view = rawView==="vsadded" && !oppAddedId ? null : rawView;

  // lazy-load batter-vs-pitcher lines the first time each tab flips open
  useEffect(() => {
    if (view !== "vssp" || !canVs || !lineup?.players?.length) return;
    let alive = true;
    setVsLoading(true);
    (async () => {
      const data = {};
      await mapPool(lineup.players, 4, async p=>{
        data[p.id] = await loadBatterVs(p.id, oppPitcherId);
      });
      if (alive) { setVsData(data); setVsLoading(false); }
    })();
    return () => { alive = false; };
  }, [view, canVs, oppPitcherId, lineup]);

  useEffect(() => {
    if (view !== "vsadded" || !oppAddedId || !lineup?.players?.length) return;
    let alive = true;
    setVsLoadingAdded(true);
    (async () => {
      const data = {};
      await mapPool(lineup.players, 4, async p=>{
        data[p.id] = await loadBatterVs(p.id, oppAddedId);
      });
      if (alive) { setVsDataAdded({ pid:oppAddedId, data }); setVsLoadingAdded(false); }
    })();
    return () => { alive = false; };
  }, [view, oppAddedId, lineup]);

  const activeVsData = view === "vsadded"
    ? (vsDataAdded.pid===oppAddedId ? vsDataAdded.data : {})   // stale if he changed
    : vsData;
  const activeVsLoading = view === "vsadded" ? vsLoadingAdded : vsLoading;

  const tabBtn = (id,label,enabled=true) => (
    <button onClick={()=>enabled&&setView(v=>v===id?null:id)} disabled={!enabled}
      style={{ flex:1, padding:"5px 8px", border:"none", cursor:enabled?"pointer":"not-allowed",
        fontFamily:MONO, fontSize:9.5, letterSpacing:"0.06em", textTransform:"uppercase",
        background: view===id ? C.ink : "transparent", color: view===id ? "#fff" : (enabled?C.inkSoft:C.rule),
        borderRadius:2 }}>{label}</button>
  );

  // each of the 3 sections below is placed as its own item in the shared
  // away/home grid (see .ts-lineups) rather than nested inside one tall
  // column div — that's what keeps, say, the batting-five row level between
  // the two sides even when one side's pitcher box is taller than the
  // other's (e.g. it has vs-team history rows the other side doesn't).
  return (
    <>
    <div className="ts-lineup-col" style={{ minWidth:0, gridColumn:col, gridRow:1 }}>
      {/* starting pitcher (upcoming games) or the full game's pitching line
          (live/finished games) — shown above the lineup. Always dark,
          matching the calendar's own dark card shade, in both states. */}
      <div style={{ margin:"10px 10px 6px", padding:"10px 12px", borderRadius:3,
        background:"#20232A", border:`1px solid ${C.darkBorder}` }}>
        {showBoxPitching ? (
          <>
            {!boxPitchers ? (
              <div style={{ fontFamily:MONO, fontSize:12, color:C.darkTextSoft }}>Loading…</div>
            ) : boxPitchers.length===0 ? (
              <div style={{ fontFamily:SANS, fontSize:13, color:C.darkTextSoft }}>No pitching stats yet.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <PLineHeader dark />
                {boxPitchers.map(p => <PitcherStatLine key={p.pid} p={p} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <PitcherBlock name={pitcherName} pid={pitcherId} vsName={oppName} era={era} oppTeamId={oppTeamId} date={date} bare />
            {/* the probable "starter" is sometimes just a 1-2 inning opener —
                let the viewer look up the actual bulk pitcher alongside them */}
            <AddPitcherBlock oppName={oppName} oppTeamId={oppTeamId} date={date}
              added={added} setAdded={setAdded} />
          </>
        )}
      </div>
    </div>

    {/* last 5 games' batting score + actual hits, above the lineup — its own
        grid row so it lines up with the other side's regardless of how tall
        either side's pitcher box above it happens to be. */}
    {battingLine && (
      <div style={{ minWidth:0, gridColumn:col, gridRow:2, margin:"0 10px 8px" }}>
        <BattingFive games={battingLine} />
      </div>
    )}

    <div style={{ minWidth:0, gridColumn:col, gridRow:3 }}>
      {/* view toggle — a confirmed/pending badge for the batting lineup
          sits before the tabs themselves */}
      <div style={{ display:"flex", alignItems:"center", gap:3, padding:"6px 10px 2px", borderBottom:`1px solid #EEF0F2` }}>
        <ConfirmBadge confirmed={lineup?.source==="confirmed"}
          title={!lineup ? "Lineup loading…" : lineup.source==="confirmed" ? "Batting lineup confirmed"
            : lineup.source==="projected" ? "Batting lineup projected" : "No lineup yet"} />
        {tabBtn("vssp", canVs ? `vs ${oppPitcherName.split(" ").slice(-1)[0]}` : "vs SP", canVs)}
        {oppAdded && tabBtn("vsadded", `vs ${oppAdded.name.split(" ").slice(-1)[0]}`)}
        {tabBtn("last5","Last 5")}
      </div>

      <div style={{ padding:"4px 0 12px" }}>
        {/* nothing renders here until a tab is tapped open */}
        {view && (view==="last5" ? (
          <div style={{ display:"grid", gridTemplateColumns:ROW_COLS, gap:6, padding:"2px 10px",
            fontFamily:MONO, fontSize:9, letterSpacing:"0.04em", textTransform:"uppercase",
            color:C.ruleDark, alignItems:"center" }}>
            <span>Hitter</span><span style={{ textAlign:"right" }}>AVG</span>
            <span style={{ textAlign:"center" }}>H</span>{SEP}
            <span style={{ textAlign:"center" }}>TB</span>{SEP}
            <span style={{ textAlign:"center" }}>HRR</span>
          </div>
        ) : (
          <div style={{ display:"flex", gap:4, padding:"2px 10px",
            fontFamily:MONO, fontSize:9, letterSpacing:"0.04em", textTransform:"uppercase",
            color:C.ruleDark, alignItems:"center" }}>
            <span style={{ flex:"1 1 auto", minWidth:0 }}>Hitter</span>
            <div style={{ display:"grid", gridTemplateColumns:VS_STAT_COLS, gap:3, flexShrink:0 }}>
              <span style={{ textAlign:"right" }}>AB</span><span style={{ textAlign:"right" }}>H</span>
              <span style={{ textAlign:"right" }}>HR</span><span style={{ textAlign:"right" }}>AVG</span>
            </div>
          </div>
        ))}

        {view && !lineup && <div style={{ padding:"10px 12px", fontFamily:MONO, fontSize:12, color:C.inkSoft }}>Loading lineup…</div>}
        {view && lineup && lineup.players.length===0 &&
          <div style={{ padding:"8px 12px", fontFamily:SANS, fontSize:12, color:C.inkSoft }}>—</div>}

        {view && lineup && (view==="last5" ? (
          lineup.players.map(p=>{
            const hot = nameStreak(p);
            return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:ROW_COLS, gap:6,
              padding:"3px 10px", alignItems:"center", borderTop:`1px solid #EEF0F2` }}>
              {/* now that the teammate mark applies to every game, both can
                  land on the same hitter — the fill goes to the teammate tie
                  and the streak keeps a yellow underline rather than being
                  silently overwritten */}
              <span style={{ fontFamily:SANS, fontSize:12.5, whiteSpace:"nowrap",
                overflow:"hidden", textOverflow:"ellipsis", borderRadius:1,
                background: wasMate(p.id) ? C.softRevenge
                  : hot ? "rgba(255,233,77,0.5)" : "transparent",
                boxShadow: wasMate(p.id) && hot
                  ? `inset 0 -2px 0 ${C.markerDeep}` : "none" }}
                title={wasMate(p.id)
                  ? `${p.name} — ${MATE_TITLE}${hot ? " · also on a hitting streak" : ""}`
                  : p.name}>
                <span className="ts-hitter-full">{p.name}</span>
                <span className="ts-hitter-abbr">{abbrevName(p.name)}</span>
              </span>
              <span style={{ fontFamily:MONO, fontSize:11, color:C.inkSoft, textAlign:"right" }}>{p.avg || "—"}</span>
              <SeqBlock arr={p.h} label="hits" onPick={onStat && (()=>onStat(p.name,"hits"))} />{SEP}
              <SeqBlock arr={p.tb} label="total bases" onPick={onStat && (()=>onStat(p.name,"totalBases"))} />{SEP}
              <SeqBlock arr={p.hrr} label="H+R+RBI" onPick={onStat && (()=>onStat(p.name,"hits+runs+rbi"))} />
            </div>
            );
          })
        ) : (
          // vs-pitcher view (either the opposing starter, or the added bulk
          // pitcher) — the names and the AB/H/HR/AVG stats are two separate
          // stacks side by side rather than one grid per row, so the names
          // can scroll horizontally as a single unit (one shared scrollbar
          // for the whole lineup, not one per row) while the stat columns
          // stay pinned to the right edge.
          <div style={{ display:"flex", gap:4, padding:"0 10px" }}>
            <div className="ts-vs-names-scroll" style={{ flex:"1 1 auto", minWidth:0, overflowX:"auto" }}>
              {lineup.players.map(p=>(
                <div key={p.id} title={wasMate(p.id) ? `${p.name} — ${MATE_TITLE}` : p.name}
                  style={{ whiteSpace:"nowrap", padding:"3px 0",
                  height:18, lineHeight:"18px", borderTop:`1px solid #EEF0F2`,
                  fontFamily:SANS, fontSize:12.5 }}>
                  <span style={{ background: wasMate(p.id) ? C.softRevenge : "transparent",
                    borderRadius:1 }}>
                    <span className="ts-hitter-full">{p.name}</span>
                    <span className="ts-hitter-abbr">{abbrevName(p.name)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ flexShrink:0 }}>
              {lineup.players.map(p=>{
                const st = activeVsData[p.id];
                return (
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:VS_STAT_COLS, gap:3,
                  padding:"3px 0", height:18, lineHeight:"18px", alignItems:"center",
                  borderTop:`1px solid #EEF0F2` }}>
                  {activeVsLoading && !st ? (
                    <span style={{ gridColumn:"1 / span 4", fontFamily:MONO, fontSize:10,
                      color:C.ruleDark, textAlign:"right" }}>…</span>
                  ) : !st || Number(st.atBats)===0 ? (
                    <span style={{ gridColumn:"1 / span 4", fontFamily:MONO, fontSize:10,
                      color:C.ruleDark, textAlign:"right" }}>no history</span>
                  ) : (
                    <>
                      <span style={{ fontFamily:MONO, fontSize:11, textAlign:"right", color:C.ink }}>{st.atBats}</span>
                      <span style={{ fontFamily:MONO, fontSize:11, textAlign:"right",
                        color: Number(st.hits)>0?C.over:C.ink }}>{st.hits}</span>
                      <span style={{ fontFamily:MONO, fontSize:11, textAlign:"right",
                        color: Number(st.homeRuns)>0?C.over:C.ink }}>{st.homeRuns}</span>
                      <span style={{ fontFamily:MONO, fontSize:11, textAlign:"right", fontWeight:700,
                        color: (parseFloat(st.avg)||0) < 0.200 ? C.under
                             : (parseFloat(st.avg)||0) > 0.250 ? C.over : C.ink }}>{st.avg}</span>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
        {view==="vssp" && !canVs && (
          <div style={{ padding:"8px 12px", fontFamily:SANS, fontSize:12, color:C.inkSoft }}>
            No probable starter posted for {oppName} yet.</div>)}
      </div>
    </div>
    </>
  );
}

/* lets the viewer manually add a second pitcher's info next to the
   probable starter — for when the listed "starter" is really just an
   opener going 1-2 innings and the actual bulk pitcher is someone else.
   `added`/`setAdded` are controlled from TeamPanel so it can also surface a
   "vs [added pitcher]" lineup tab once one is added. Styled for the dark
   pitcher box it lives in. */
function AddPitcherBlock({ oppName, oppTeamId, date, added, setAdded }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [era, setEra] = useState(null);

  useEffect(() => {
    // nothing to reset when cleared — the era value simply goes unused
    // once `added` is null (this block stops rendering the added pitcher)
    if (!added) return;
    let alive = true;
    loadPitcherSeason(added.id).then(log => { if (alive) setEra(pitcherSeasonAverages(log).era); });
    return () => { alive = false; };
  }, [added]);

  const resolve = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/sports/1/players?season=${SEASON}`);
      if (!r.ok) throw new Error(`roster ${r.status}`);
      const j = await r.json();
      const people = j.people || [];
      const ql = q.toLowerCase();
      const hit = people.find(p => (p.fullName||"").toLowerCase().includes(ql));
      if (!hit) throw new Error(`No ${SEASON} MLB player matched "${q}".`);
      setAdded({ id: hit.id, name: hit.fullName });
      setOpen(false); setQuery("");
    } catch (e) {
      setErr(isNet(e.message) ? "Couldn't reach the MLB data service." : e.message);
    } finally { setBusy(false); }
  };

  if (added) {
    return (
      <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.darkBorder}`, position:"relative" }}>
        <button onClick={()=>setAdded(null)} title="Remove this pitcher"
          aria-label="Remove this pitcher"
          style={{ position:"absolute", top:8, right:0, border:"none", background:"transparent",
            color:C.darkTextSoft, cursor:"pointer", fontFamily:MONO, fontSize:13, padding:4, lineHeight:1 }}>✕</button>
        <PitcherBlock name={added.name} pid={added.id} vsName={oppName} era={era} oppTeamId={oppTeamId} date={date} bare />
      </div>
    );
  }

  if (open) {
    return (
      <div style={{ marginTop:8 }}>
        <div style={{ display:"flex", gap:6 }}>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") resolve(); if(e.key==="Escape") setOpen(false); }}
            placeholder="Bulk pitcher's name" style={{ ...inputStyle, flex:1, fontSize:13,
              background:"#2A2E38", color:C.darkText, border:`1px solid ${C.darkOutline}` }} />
          <button onClick={resolve} disabled={busy} style={{ border:`1px solid ${C.darkText}`,
            background:busy?C.darkOutline:C.darkText, color:busy?C.darkTextSoft:"#14181F",
            borderRadius:2, fontFamily:MONO, fontSize:11,
            padding:"6px 12px", cursor:busy?"default":"pointer" }}>{busy?"…":"Add"}</button>
          <button onClick={()=>{ setOpen(false); setErr(""); }} style={{ border:`1px solid ${C.darkOutline}`,
            background:"transparent", color:C.darkTextSoft, borderRadius:2, fontFamily:MONO, fontSize:11,
            padding:"6px 10px", cursor:"pointer" }}>Cancel</button>
        </div>
        {err && <div style={{ marginTop:6, fontFamily:SANS, fontSize:12, color:C.under }}>{err}</div>}
      </div>
    );
  }

  return (
    <button onClick={()=>setOpen(true)} style={{ marginTop:8, border:`1px dashed ${C.darkOutline}`,
      background:"transparent", color:C.darkTextSoft, borderRadius:3, fontFamily:MONO, fontSize:11,
      padding:"5px 10px", cursor:"pointer" }}>+ Add a pitcher to check</button>
  );
}

// single-line text that shrinks its font-size to fit the container's width
// instead of wrapping or ellipsis-truncating.
function FitTitle({ text, maxSize = 18, minSize = 12, style }) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(maxSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = maxSize;
      el.style.fontSize = size + "px";
      while (el.scrollWidth > el.clientWidth && size > minSize) {
        size -= 1;
        el.style.fontSize = size + "px";
      }
      setFontSize(size);
    };
    fit();
    // same rotation-race fix as PLine — observe the element, not the window
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxSize, minSize]);
  return <div ref={ref} style={{ whiteSpace:"nowrap", overflow:"hidden", fontSize, ...style }}>{text}</div>;
}

/* the modal's matchup title, split down the same midline the two team
   columns below it share: away team name fixed to the box's left edge,
   home team name fixed to the start of the right half, and "@" hugging the
   midline from the left (end of the away side). */
function MatchupTitle({ away, home }) {
  const titleStyle = { fontFamily:SANS, fontWeight:800, letterSpacing:"-0.01em" };
  return (
    <div style={{ display:"flex", marginTop:4 }}>
      <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline",
        justifyContent:"space-between", gap:6 }}>
        <FitTitle text={away} maxSize={18} minSize={11} style={{ ...titleStyle, minWidth:0, flex:"1 1 auto" }} />
        <span style={{ ...titleStyle, fontSize:15, color:C.inkSoft, flexShrink:0 }}>@</span>
      </div>
      <div style={{ flex:1, minWidth:0, paddingLeft:6 }}>
        <FitTitle text={home} maxSize={18} minSize={11} style={titleStyle} />
      </div>
    </div>
  );
}

function GameModal({ m, tags, setTag, now, onClose, ensureBattingLine }) {
  const { date, games, trends } = m;
  const [idx, setIdx] = useState(m.idx || 0);
  const g = games[idx];
  const t = trends[idx];
  const hasPrev = idx > 0, hasNext = idx < games.length - 1;
  const go = (delta) => { setTagEditing(false); setIdx(i => Math.min(games.length-1, Math.max(0, i+delta))); };

  // the batting-score line (BAT number + hits, in each side's lineup
  // column) is genuinely expensive to compute — a box-score fetch per
  // recent game plus a season-rate fetch per pitcher involved — so it's
  // only ever fetched here, once a game is actually open, for just its
  // two teams. Re-fires when arrow-navigating to a different game.
  useEffect(() => {
    ensureBattingLine?.([g.awayId, g.homeId], g.time);
  }, [g.awayId, g.homeId, g.time, ensureBattingLine]);
  const [awayLU, setAwayLU] = useState(null);
  const [homeLU, setHomeLU] = useState(null);
  const [h2h,    setH2H]    = useState(undefined);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [teammateMarks, setTeammateMarks] = useState(null);   // lineup teamId -> Set(playerId)
  // Extra ("bulk") pitchers, one per staff. Held here rather than inside a
  // panel because the side that ADDS an arm and the lineup that has to BAT
  // against him are different panels. Keyed by gamePk so arrowing to the next
  // game starts clean without a reset effect.
  const [addedPitchers, setAddedPitchers] = useState({});
  const addedFor = (side) => addedPitchers[g.gamePk]?.[side] || null;
  const setAddedFor = (side, val) => setAddedPitchers(m => ({
    ...m, [g.gamePk]: { ...(m[g.gamePk]||{}), [side]: val } }));
  const [pick,   setPick]   = useState(null);   // {name, stat, ts} -> prop analyzer
  // live/finished games show the game's actual box score (line score by
  // inning, and the actual pitching line) instead of pre-game previews. MLB's
  // API sometimes flips a game to "Live" a little ahead of its listed start
  // time (and even then, the box score can list the probable starter with an
  // all-zero line the instant they take the mound) — hold off on treating the
  // game as live until that start time has actually passed, same as the
  // calendar card's own LIVE badge/bases-display gating.
  const final = g.isFinal && g.awayScore!=null && g.homeScore!=null;
  const live = g.isLive && !final && now.getTime() >= new Date(g.time).getTime();
  const showBoxPitching = final || live;
  const showLineScore = showBoxPitching;
  const [ls,     setLs]     = useState(showLineScore ? undefined : null);  // line score (live/finished only)
  const [boxPitching, setBoxPitching] = useState(showBoxPitching ? undefined : null);
  const [tagEditing, setTagEditing] = useState(false);
  const [copied, setCopied] = useState(null);   // ok|dl|err feedback for Export
  const tagVal = tagText(tags?.[g.gamePk]);

  // export a clean PNG of this game's calendar card, styled like today's
  // slate's dark charcoal card (light text) regardless of which day it's
  // actually from, with the tagged play as green monospace "code" on the right
  const exportCard = () => {
    try {
      const scale = 3, W = 300, H = 96;                // logical size, upscaled for crispness
      const cv = document.createElement("canvas");
      cv.width = W*scale; cv.height = H*scale;
      const x = cv.getContext("2d"); x.scale(scale, scale);
      const resultTint = tagResultBg(tags?.[g.gamePk]);
      const final = g.isFinal && g.awayScore!=null && g.homeScore!=null;
      const aw = TEAM_ABBR[g.awayId]||"?", hm = TEAM_ABBR[g.homeId]||"?";
      const time = new Date(g.time).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
      // paper margin — matches the app's own light page background
      x.fillStyle = "#E2E5EA"; x.fillRect(0,0,W,H);
      const pad = 10, cx = pad, cy = pad, cw = W-pad*2, ch = H-pad*2;
      const rr = 4;
      roundedRectPath(x, cx, cy, cw, ch, rr);
      // card — dark charcoal like today's slate, with an optional soft
      // win/loss tint layered on top
      x.fillStyle = "#20232A"; x.fill();
      if (resultTint) { x.fillStyle = resultTint; x.fill(); }
      x.strokeStyle = "#3A4250"; x.lineWidth = 1; x.stroke();
      // time / FINAL, top-right
      x.fillStyle = "#AEB7C4"; x.font = "9px ui-monospace, Menlo, monospace";
      x.textAlign = "right"; x.fillText(final?"FINAL":time, cx+cw-8, cy+14);
      // teams + scores
      x.textAlign = "left"; x.fillStyle = "#F2F4F7";
      x.font = "700 15px system-ui, sans-serif";
      x.fillText(aw, cx+12, cy+34);
      x.fillText(hm, cx+12, cy+56);
      if (final) {
        x.textAlign = "right"; x.font = "700 15px ui-monospace, Menlo, monospace";
        x.fillStyle = g.awayScore>g.homeScore ? "#F2F4F7" : "#AEB7C4";
        x.fillText(String(g.awayScore), cx+cw-14, cy+34);
        x.fillStyle = g.homeScore>g.awayScore ? "#F2F4F7" : "#AEB7C4";
        x.fillText(String(g.homeScore), cx+cw-14, cy+56);
      }
      // logo icon in the gap between the team names and the play — same
      // spot on every card, whether or not this one has a tagged play
      drawLogoIcon(x, cx + cw*0.27, cy + ch/2, 26);
      // the play: grade indicator box + green monospace "code" text, both
      // anchored at a fixed indent in the middle of the card
      if (tagVal) {
        const entry = tags?.[g.gamePk];
        const gradeResult = entry && typeof entry === "object" ? entry.result : null;
        const indentX = cx + cw*0.39, midY = cy + ch/2;
        drawPlayIndicator(x, gradeResult, indentX, midY-7, 14);
        const rightLimit = final ? cx+cw-40 : cx+cw-10;
        drawGreenTag(x, stripPlayPrefix(tagVal), indentX+20, midY, rightLimit-(indentX+20), 14);
      }
      copyCanvas(cv, `${aw}-${hm}-${(g.time||"").slice(0,10)}.png`, setCopied);
    } catch (e) {
      console.error("exportCard failed:", e);
      setCopied("err"); setTimeout(()=>setCopied(null), 2000);
    }
  };

  useEffect(() => {
    let alive = true;
    // box score by inning + full game pitching line — live/finished games
    // only, re-checked as `live` itself flips once real game time passes
    // (see the `live` gating above) so a modal left open through first pitch
    // picks up the actual in-progress stats without needing to be reopened.
    if (final || live) {
      loadLineScore(g.gamePk).then(r=>{ if(alive) setLs(r); });
      loadBoxscorePitchers(g.gamePk, final).then(r=>{ if(alive) setBoxPitching(r); });
    }
    return () => { alive = false; };
  }, [g.gamePk, final, live]);

  useEffect(() => {
    let alive = true;
    // The head-to-head strip sits at the very bottom of the modal while the
    // lineups are its main body, so these run alongside each other rather
    // than making the body wait on a summary the viewer has to scroll to.
    loadH2H(g.awayId, g.homeId)
      .then(s => { if(alive) setH2H(s); })
      .catch(() => { if(alive) setH2H(null); });
    for (const side of ["away","home"]) {
      loadLineup(g._raw, side, date).then(async lu=>{
        const players = await mapPool(lu.players, 4, async pl=>({ ...pl, ...(await loadBatterTrend(pl.id, date)) }));
        if(!alive) return;
        (side==="away"?setAwayLU:setHomeLU)({ ...lu, players });
      });
    }
    return () => { alive = false; };
  }, [g, date]);

  // Mark the hitters on each side who once played alongside the starter they
  // are facing. Each lineup is paired with the OTHER side's pitcher, which is
  // the same relationship the Homecoming Jinx version marked — it just no
  // longer waits for a jinx to be present. Waits on the lineups, since there
  // is nothing to mark until they land, and re-running as the second side
  // arrives is cheap because loadTeamSeasons caches per player.
  useEffect(() => {
    const pairs = [];
    if (awayLU?.players?.length && g.homePid)
      pairs.push({ key:g.awayId, pitcherId:g.homePid, players:awayLU.players });
    if (homeLU?.players?.length && g.awayPid)
      pairs.push({ key:g.homeId, pitcherId:g.awayPid, players:homeLU.players });
    if (!pairs.length) return;
    let alive = true;
    loadTeammateMarks(pairs)
      .then(byTeam => { if (alive) setTeammateMarks({ gamePk:g.gamePk, byTeam }); })
      .catch(()=>{});
    return () => { alive = false; };
  }, [g.gamePk, g.awayId, g.homeId, g.awayPid, g.homePid, awayLU, homeLU]);
  // tagged with the game it was built for, so arrowing to the next game shows
  // nothing rather than briefly carrying the previous game's marks across
  const matesFor = (teamId) =>
    teammateMarks?.gamePk === g.gamePk ? teammateMarks.byTeam?.[teamId] : undefined;

  // arrow keys navigate between the day's games
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [games.length]);

  // lock background scroll while open. Just setting overflow:hidden isn't
  // enough — if the page was already scrolled down, some browsers still
  // paint this fixed overlay against the stale scroll offset, so it opens
  // looking cut off until you scroll the (frozen) background to "catch up".
  // Actually pinning the body in place with a negative offset removes it
  // from the scrolling flow entirely, so the fixed overlay always lines up
  // with the real viewport no matter how far down the page was scrolled.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top,
      width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const aAbbr = TEAM_ABBR[g.awayId]||"?", hAbbr = TEAM_ABBR[g.homeId]||"?";
  const time = new Date(g.time).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:50,
      background:"rgba(20,24,31,0.55)", display:"flex", alignItems:"center",
      justifyContent:"center", padding:"max(12px, env(safe-area-inset-top)) 12px 12px" }}>

      {/* side nav arrows — same day's games only */}
      {hasPrev && (
        <button onClick={e=>{ e.stopPropagation(); go(-1); }} aria-label="Previous game"
          className="ts-nav-arrow" style={{ position:"fixed", left:8, top:"50%", transform:"translateY(-50%)",
          zIndex:55, width:42, height:42, borderRadius:"50%", border:`1px solid ${C.ink}`,
          background:C.paper, color:C.ink, fontFamily:MONO, fontSize:18, cursor:"pointer",
          boxShadow:"0 4px 14px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
      )}
      {hasNext && (
        <button onClick={e=>{ e.stopPropagation(); go(1); }} aria-label="Next game"
          className="ts-nav-arrow" style={{ position:"fixed", right:8, top:"50%", transform:"translateY(-50%)",
          zIndex:55, width:42, height:42, borderRadius:"50%", border:`1px solid ${C.ink}`,
          background:C.paper, color:C.ink, fontFamily:MONO, fontSize:18, cursor:"pointer",
          boxShadow:"0 4px 14px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      )}

      <div onClick={e=>e.stopPropagation()} style={{ background:C.paper,
        border:`1px solid ${C.ink}`, borderRadius:6, maxWidth:760, width:"100%",
        maxHeight:"100%", overflowY:"auto", overflowX:"hidden",
        boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>

        {/* sticky region: header + tag editor scroll together. the card
            itself is now the scrolling element (not the full-screen overlay
            behind it), so content scrolling up passes behind this sticky
            block and disappears cleanly into it instead of just scrolling
            off the top of the screen. */}
        <div style={{ position:"sticky", top:0, zIndex:3, background:C.paper,
          borderTopLeftRadius:6, borderTopRightRadius:6 }}>
        {/* header */}
        <div className="ts-modal-head" style={{ padding:"14px 18px", borderBottom:`2px solid ${C.ink}`,
          background:C.paper, borderTopLeftRadius:6, borderTopRightRadius:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.14em",
              textTransform:"uppercase", color:C.inkSoft, minWidth:0 }}>{prettyDay(date)} · {time}
              {games.length>1 && <span style={{ color:C.ruleDark }}> · game {idx+1}/{games.length}</span>}</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              {games.length>1 && (
                <span className="ts-nav-inline" style={{ display:"none", gap:4 }}>
                  <button onClick={()=>go(-1)} disabled={!hasPrev} aria-label="Previous game"
                    style={{ width:32, height:32, borderRadius:4, border:`1px solid ${C.rule}`,
                      background:"#fff", color:hasPrev?C.ink:C.rule, fontFamily:MONO, fontSize:16,
                      cursor:hasPrev?"pointer":"default", lineHeight:1 }}>‹</button>
                  <button onClick={()=>go(1)} disabled={!hasNext} aria-label="Next game"
                    style={{ width:32, height:32, borderRadius:4, border:`1px solid ${C.rule}`,
                      background:"#fff", color:hasNext?C.ink:C.rule, fontFamily:MONO, fontSize:16,
                      cursor:hasNext?"pointer":"default", lineHeight:1 }}>›</button>
                </span>
              )}
              <button onClick={()=>setTagEditing(v=>!v)}
                title={tagVal ? "Edit play tag" : "Tag this game"}
                style={{ border:`1px solid ${tagVal?"#D7263D":C.rule}`,
                  background:tagVal?"#F2657A":"#fff", color:tagVal?"#fff":C.ink,
                  borderRadius:3, fontFamily:MONO, fontSize:11, letterSpacing:"0.08em",
                  textTransform:"uppercase", padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>
                {tagVal ? "Play ✓" : "Play"}</button>
              <button onClick={exportCard} title="Copy game image to clipboard"
                aria-label="Copy game image"
                style={{ border:`1px solid ${copied==="ok"?C.over:C.rule}`, background:"#fff",
                  color:copied==="ok"?C.over:C.ink,
                  borderRadius:3, fontFamily:MONO, fontSize:11, letterSpacing:"0.08em",
                  textTransform:"uppercase", padding:"5px 10px", cursor:"pointer" }}>
                {copied==="ok" ? "Copied ✓" : copied==="dl" ? "Saved ✓" : copied==="err" ? "Failed" : "Copy"}</button>
              <button onClick={onClose} style={{ border:`1px solid ${C.rule}`, background:"#fff",
                borderRadius:2, fontFamily:MONO, fontSize:13, padding:"4px 10px", cursor:"pointer" }}>✕</button>
            </div>
          </div>
          <MatchupTitle away={g.awayName} home={g.homeName} />
        </div>

        {/* tag editor */}
        {tagEditing && (
          <div style={{ padding:"10px 18px", borderBottom:`1px solid ${C.rule}`, background:"#FFF3F4",
            display:"flex", gap:8, alignItems:"center" }}>
            <input autoFocus defaultValue={tagVal}
              placeholder="e.g. PLAY · over 8.5 · fade the public"
              onKeyDown={e=>{ if(e.key==="Enter"){ setTag(g, e.target.value); setTagEditing(false); } }}
              onBlur={e=>{ setTag(g, e.target.value); }}
              style={{ flex:1, ...inputStyle }} />
            <button onMouseDown={e=>{ e.preventDefault(); setTag(g, ""); setTagEditing(false); }}
              style={{ border:`1px solid ${C.rule}`, background:"#fff", borderRadius:2,
                fontFamily:MONO, fontSize:11, padding:"6px 10px", cursor:"pointer", color:C.under }}>Remove</button>
          </div>
        )}
        </div>
        {/* end sticky region */}

        {/* ── BOX SCORE BY INNING (live/finished games, above H2H) — always
             shows a full 9-inning grid, padding in blank columns for
             innings not reached yet so a live game's box score doesn't
             visually resize as it goes. ── */}
        {showLineScore && ls !== null && (
          <div style={{ padding:"12px 18px", borderBottom:`1px solid ${C.rule}` }}>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.12em", textTransform:"uppercase",
              color:C.inkSoft, marginBottom:6 }}>{final ? "Final" : "Live"} · line score</div>
            {ls === undefined ? (
              <div style={{ fontFamily:MONO, fontSize:12, color:C.inkSoft }}>Loading…</div>
            ) : (() => {
              const played = ls.innings || [];
              const innings = Array.from({ length: Math.max(9, played.length) },
                (_, i) => played[i] || { num: i+1 });
              const tot = ls.teams || {};
              const cell = { fontFamily:MONO, fontSize:12, textAlign:"center", padding:"3px 0" };
              const head = { ...cell, fontSize:9, color:C.ruleDark, letterSpacing:"0.04em" };
              const tcol = "minmax(54px,1fr)";
              const cols = `${tcol} repeat(${innings.length}, 18px) 10px 22px 22px 22px`;
              const Row = ({ side, label }) => {
                const t = tot[side] || {};
                return (
                  <div style={{ display:"grid", gridTemplateColumns:cols, gap:3, alignItems:"center" }}>
                    <span style={{ fontFamily:SANS, fontSize:12.5, fontWeight:700, whiteSpace:"nowrap",
                      overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>
                    {innings.map((inn,i)=>{
                      const v = inn[side]?.runs;
                      return <span key={i} style={cell}>{v==null?"-":v}</span>;
                    })}
                    <span/>
                    <span style={{ ...cell, fontWeight:700 }}>{t.runs ?? 0}</span>
                    <span style={cell}>{t.hits ?? 0}</span>
                    <span style={cell}>{t.errors ?? 0}</span>
                  </div>
                );
              };
              return (
                <div style={{ overflowX:"auto" }}>
                  <div style={{ display:"grid", gridTemplateColumns:cols, gap:3 }}>
                    <span/>
                    {innings.map((inn,i)=><span key={i} style={head}>{inn.num||i+1}</span>)}
                    <span/>
                    <span style={{ ...head, fontWeight:700, color:C.inkSoft }}>R</span>
                    <span style={head}>H</span>
                    <span style={head}>E</span>
                  </div>
                  <Row side="away" label={aAbbr} />
                  <Row side="home" label={hAbbr} />
                </div>
              );
            })()}
          </div>
        )}

        {/* situational-trend indicators — full-width strip split into the
            away team's 6 slots (left half) and home team's 6 (right half),
            lined up with the columns below */}
        {t && <TrendIndicatorRow t={t} awayId={g.awayId} homeId={g.homeId} />}

        {/* ── lineups: away left, home right (stays side-by-side on mobile) ──
            each team's pitcher-box / batting-five / lineup are 3 separate
            grid rows shared across both columns (see TeamPanel), so a taller
            pitcher box on one side never pushes that side's batting-five or
            lineup out of line with the other side's. */}
        <div className="ts-lineups" style={{ gap:0 }}>
          {/* away panel: adds to the AWAY staff, but its hitters bat against
              whatever extra arm the HOME side added */}
          <TeamPanel oppName={g.homeName} col={1} mates={matesFor(g.awayId)}
            added={addedFor("away")} setAdded={v=>setAddedFor("away",v)}
            oppAdded={addedFor("home")}
            lineup={awayLU} pitcherName={g.awayPname} pitcherId={g.awayPid}
            oppPitcherName={g.homePname} oppPitcherId={g.homePid}
            oppTeamId={g.homeId} date={date} era={t ? t.pitcherEra(g.awayId) : null}
            battingLine={t ? t.hitsLine(g.awayId) : null}
            showBoxPitching={showBoxPitching} boxPitchers={boxPitching?.away}
            onStat={(name,stat)=>setPick({ name, stat, ts:Date.now() })} />
          <div style={{ gridColumn:2, gridRow:"1 / span 3", background:C.rule }} />
          <TeamPanel oppName={g.awayName} col={3} mates={matesFor(g.homeId)}
            added={addedFor("home")} setAdded={v=>setAddedFor("home",v)}
            oppAdded={addedFor("away")}
            lineup={homeLU} pitcherName={g.homePname} pitcherId={g.homePid}
            oppPitcherName={g.awayPname} oppPitcherId={g.awayPid}
            oppTeamId={g.awayId} date={date} era={t ? t.pitcherEra(g.homeId) : null}
            battingLine={t ? t.hitsLine(g.homeId) : null}
            showBoxPitching={showBoxPitching} boxPitchers={boxPitching?.home}
            onStat={(name,stat)=>setPick({ name, stat, ts:Date.now() })} />
        </div>

        {/* ── H2H OVERVIEW (bottom) — tap to expand the past meetings ── */}
        <div style={{ padding:"12px 18px 16px", borderTop:`1px solid ${C.rule}`, background:C.card }}>
          <div onClick={()=> h2h && h2h.played>0 && setH2hOpen(v=>!v)}
            style={{ cursor: h2h && h2h.played>0 ? "pointer" : "default" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
              <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.12em", textTransform:"uppercase",
                color:C.inkSoft, marginBottom:6 }}>Season head-to-head</div>
              {h2h && h2h.played>0 && (
                <span style={{ fontFamily:MONO, fontSize:10, color:C.inkSoft, marginBottom:6,
                  transform: h2hOpen?"rotate(180deg)":"none", transition:"transform 0.15s" }}>▾</span>
              )}
            </div>
            {h2h===undefined ? (
              <div style={{ fontFamily:MONO, fontSize:12, color:C.inkSoft }}>Loading…</div>
            ) : !h2h || h2h.played===0 ? (
              <div style={{ fontFamily:SANS, fontSize:13, color:C.inkSoft }}>
                No completed meetings yet this season{h2h&&h2h.upcoming>0?` · ${h2h.upcoming} scheduled`:""}.</div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                <div style={{ fontFamily:MONO, fontSize:20, fontWeight:700 }}>
                  <span style={{ color: h2h.aw>h2h.bw?C.over:C.ink }}>{aAbbr} {h2h.aw}</span>
                  <span style={{ color:C.ruleDark }}> – </span>
                  <span style={{ color: h2h.bw>h2h.aw?C.over:C.ink }}>{h2h.bw} {hAbbr}</span>
                </div>
                {h2h.upcoming>0 && <span style={{ fontFamily:MONO, fontSize:10.5, color:C.ruleDark }}>{h2h.upcoming} more scheduled</span>}
              </div>
            )}
          </div>
          {h2hOpen && h2h && h2h.played>0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.rule}`,
              display:"flex", flexDirection:"column", gap:6 }}>
              {h2h.meetings.map((mg,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"baseline", gap:10,
                  fontFamily:MONO, fontSize:11.5 }}>
                  <span style={{ color:C.ruleDark, width:38, flexShrink:0 }}>{calDay(mg.date).md}</span>
                  <span style={{ flex:1, textAlign:"right", fontWeight: mg.aScore>mg.bScore?700:400,
                    color: mg.aScore>mg.bScore?C.over:C.inkSoft }}>
                    {aAbbr} {mg.aScore}<span style={{color:C.ruleDark, fontWeight:400}}>({mg.aHits})</span></span>
                  <span style={{ color:C.ruleDark }}>–</span>
                  <span style={{ flex:1, fontWeight: mg.bScore>mg.aScore?700:400,
                    color: mg.bScore>mg.aScore?C.over:C.inkSoft }}>
                    {mg.bScore}<span style={{color:C.ruleDark, fontWeight:400}}>({mg.bHits})</span> {hAbbr}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pick && <PropModal injected={pick} onClose={()=>setPick(null)} />}
    </div>
  );
}

/* ════════════════════════════ shell ════════════════════════════ */
const RESPONSIVE_CSS = `
/* kill the browser's default body margin so the app reaches every edge
   of the viewport instead of leaving a rim of the page's default white */
html, body { margin:0; padding:0; background:${C.paper}; overscroll-behavior-y:none; }
#root { min-height:100vh; }
@keyframes ts-spin { to { transform: rotate(360deg); } }
.ts-cal { display:grid; grid-template-columns: repeat(7, minmax(340px,1fr)); overflow-x:auto; }
.ts-cal-col { min-width:340px; }
.ts-lineups { display:grid; grid-template-columns:1fr 1px 1fr; }
.ts-app { padding:calc(28px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right))
  calc(60px + env(safe-area-inset-bottom)) calc(18px + env(safe-area-inset-left)); }
.ts-cell { box-sizing:border-box; }
.ts-pitcher-head-narrow { display:none; }
.ts-hitter-abbr { display:none; }
/* vs-pitcher hitter names: one shared horizontal scroller for the whole
   lineup (not one per row) — momentum scroll on touch, thin/invisible
   scrollbar so it doesn't compete visually with the AB/H/HR/AVG columns. */
.ts-vs-names-scroll { -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
.ts-vs-names-scroll::-webkit-scrollbar { height:3px; }
.ts-vs-names-scroll::-webkit-scrollbar-thumb { background:${C.ruleDark}; border-radius:2px; }
@media (max-width:760px){
  .ts-cal { grid-auto-flow:column; grid-auto-columns:89%; grid-template-columns:none;
            overflow-x:auto; scroll-snap-type:x mandatory; scroll-padding-left:0; }
  .ts-cal-col { min-width:0; scroll-snap-align:start; }
  /* away/home stay side-by-side on mobile too (no stacking override) */
  .ts-app { padding:calc(14px + env(safe-area-inset-top)) calc(6px + env(safe-area-inset-right))
    calc(36px + env(safe-area-inset-bottom)) calc(6px + env(safe-area-inset-left)); }
  .ts-nav-arrow { display:none !important; }
  .ts-nav-inline { display:inline-flex !important; }
  .ts-modal-head { padding:10px 12px !important; gap:8px !important; }
  .ts-record-chart { flex:1 1 100% !important; min-width:0 !important; width:100%; }
  /* starting-pitcher box: name+badge on its own row, "vs ABB"+ERA below —
     the wide single-row layout gets cramped once the column is this narrow */
  .ts-pitcher-head-wide { display:none !important; }
  .ts-pitcher-head-narrow { display:block; }
  /* lineup rows: first initial + last name only, so the row has room left
     for the AB/H/HR/AVG (or hits/TB/HRR) columns beside it */
  .ts-hitter-full { display:none; }
  .ts-hitter-abbr { display:inline; }
}
* { -webkit-tap-highlight-color: transparent; }
`;

// empty/fillable box on a play's row, left of its name — click to pick it
// as a standout play; fills with the hot nut logo once picked.
function PlayStarBox({ starred, onToggle, size = 22 }) {
  return (
    <button onClick={onToggle} title={starred ? "Unpick this play" : "Pick this play"}
      aria-label={starred ? "Unpick this play" : "Pick this play"}
      style={{ width:size, height:size, borderRadius:3, cursor:"pointer", flexShrink:0,
        border:`1px solid ${starred ? C.ink : C.rule}`,
        background: starred ? C.ink : "#fff",
        display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden", padding:0 }}>
      {starred && <img src={hotNutLogo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />}
    </button>
  );
}

/* ════════════════════════ TAGS VIEW ════════════════════════ */
function TagsView({ tags, setResult, setStarred, onReady }) {
  const [range, setRange] = useState("all");   // all|month|lastmonth|7d|30d
  // defaults to showing only starred plays when the tab is first opened
  const [onlyStarred, setOnlyStarred] = useState(true);

  // build a list of tagged games: newest DAY first, earliest game-time first within a day
  const allRows = useMemo(() => {
    return Object.entries(tags || {})
      .map(([gamePk, entry]) => {
        if (typeof entry === "string") return { gamePk, text:entry, date:"", time:"", away:"", home:"", result:null, starred:false };
        return { gamePk, text:entry.text||"", date:entry.date||"", time:entry.time||"",
          away:entry.away||"", home:entry.home||"",
          awayId:entry.awayId, homeId:entry.homeId, result:entry.result||null, starred:!!entry.starred };
      })
      .filter(r => r.text)
      .sort((a,b) => {
        const d = (b.date||"").localeCompare(a.date||"");   // newest day first
        if (d !== 0) return d;
        return (b.time||"").localeCompare(a.time||"");        // latest first-pitch first
      });
  }, [tags]);

  // date-range filter
  const { rows, rangeLabel } = useMemo(() => {
    const today = new Date();
    const iso = (d)=>d.toISOString().slice(0,10);
    let from = null, to = null, label = "All time";
    if (range === "month") {
      from = iso(new Date(today.getFullYear(), today.getMonth(), 1));
      label = "This month";
    } else if (range === "lastmonth") {
      from = iso(new Date(today.getFullYear(), today.getMonth()-1, 1));
      to   = iso(new Date(today.getFullYear(), today.getMonth(), 0));
      label = "Last month";
    } else if (range === "7d") {
      const d=new Date(today); d.setDate(d.getDate()-6); from=iso(d); label="Last 7 days";
    } else if (range === "30d") {
      const d=new Date(today); d.setDate(d.getDate()-29); from=iso(d); label="Last 30 days";
    }
    const filtered = allRows.filter(r => {
      if (onlyStarred && !r.starred) return false;
      if (!r.date) return range === "all";      // undated tags only show in All time
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
    return { rows: filtered, rangeLabel: label };
  }, [allRows, range, onlyStarred]);

  const wins = rows.filter(r=>r.result==="W").length;
  const losses = rows.filter(r=>r.result==="L").length;
  const pushes = rows.filter(r=>r.result==="P").length;
  const decided = wins + losses;   // pushes don't count toward win% or net
  const graded = decided + pushes;
  const pct = decided > 0 ? Math.round((wins/decided)*100) : null;

  // cumulative net (W = +1, L = -1). Pushes don't move the record, so they're
  // left off the graph entirely. Built from the SAME ordered list as the
  // plays section: the list is newest-first, so we reverse it to run oldest→
  // newest for a correct running total, then plot left-to-right. Each point
  // gets a unique index + matchup so clicking it is unambiguous.
  const chartData = useMemo(() => {
    const chrono = rows.filter(r=>r.result==="W" || r.result==="L").slice().reverse();
    if (!chrono.length) return [];
    let net = 0;
    const origin = { i:0, label:"", net:0, result:null, matchup:"", text:"" };
    const points = chrono.map((r,i) => {
      net += r.result==="W" ? 1 : -1;
      const matchup = r.away && r.home
        ? `${TEAM_ABBR[r.awayId]||r.away}@${TEAM_ABBR[r.homeId]||r.home}` : "";
      return {
        i: i+1,
        label: r.date ? r.date.slice(5) : `#${i+1}`,
        net, result:r.result, matchup,
        text: r.text.length>22 ? r.text.slice(0,21)+"…" : r.text,
      };
    });
    return [origin, ...points];
  }, [rows]);
  // dots only at local highs/lows (direction changes) plus the first/last point
  const dotIdx = useMemo(() => {
    const s = new Set();
    chartData.forEach((d,i)=>{
      if (i===0 || i===chartData.length-1) { s.add(i); return; }
      const prev = chartData[i-1].net, next = chartData[i+1].net;
      if ((d.net>prev && d.net>next) || (d.net<prev && d.net<next)) s.add(i);
    });
    return s;
  }, [chartData]);

  // ── export: the record header, the chart exactly as currently filtered,
  // and the last 10 plays under that same filter — ungraded plays blur
  // their pick text and time (see drawPlaysRow) ──
  const [playsCopied, setPlaysCopied] = useState(null);
  const exportPlays = () => {
    if (!rows.length) { setPlaysCopied("empty"); setTimeout(()=>setPlaysCopied(null),2000); return; }
    try {
      const scale = 3;
      const W = 480, PAD = 18;
      const HEAD_H = 34, REC_H = 54, CHART_H = 130, LIST_HEAD_H = 22;
      const ROW_H = 34, ROW_GAP = 6;
      const SECTION_GAP = 14;
      const list = rows.slice(0, 10);
      const listH = list.length ? list.length*(ROW_H+ROW_GAP) - ROW_GAP : 20;
      const H = PAD*2 + HEAD_H + REC_H + SECTION_GAP + CHART_H + SECTION_GAP + LIST_HEAD_H + listH;

      const cv = document.createElement("canvas");
      cv.width = W*scale; cv.height = H*scale;
      const x = cv.getContext("2d"); x.scale(scale, scale);
      x.fillStyle = "#E2E5EA"; x.fillRect(0,0,W,H);

      let y = PAD;
      // header: wordmark + current filter description
      x.fillStyle = "#14181F"; x.font = "800 20px system-ui, sans-serif";
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillText("MLB", PAD, y+18);
      const filterDesc = `${rangeLabel.toUpperCase()}${onlyStarred ? " · PICKS ONLY" : " · ALL PLAYS"}`;
      x.fillStyle = "#525A66"; x.font = `700 9px ${MONO}`;
      x.textAlign = "right";
      x.fillText("TRACK RECORD", W-PAD, y+8);
      x.fillText(filterDesc, W-PAD, y+19);
      y += HEAD_H;

      // record: W-L, win%, graded count — same numbers as the live dashboard
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.font = "700 32px ui-monospace, Menlo, monospace";
      x.fillStyle = "#1B7F5C"; x.fillText(String(wins), PAD, y+32);
      const wWidth = x.measureText(String(wins)).width;
      x.fillStyle = "#9AA3AD"; x.fillText("–", PAD+wWidth+3, y+32);
      const dashWidth = x.measureText("–").width;
      x.fillStyle = "#D7263D"; x.fillText(String(losses), PAD+wWidth+dashWidth+8, y+32);
      x.fillStyle = "#525A66"; x.font = `500 11px ${MONO}`;
      x.fillText(`${rangeLabel}${pct!=null ? ` · ${pct}% win` : ""}`, PAD, y+46);
      x.fillStyle = "#9AA3AD"; x.font = `10px ${MONO}`;
      x.fillText(`${graded} graded${rows.length>graded ? ` · ${rows.length-graded} untracked` : ""}`, PAD, y+58);
      y += REC_H + SECTION_GAP;

      drawNetChart(x, PAD, y, W-PAD*2, CHART_H, chartData, dotIdx);
      y += CHART_H + SECTION_GAP;

      x.fillStyle = "#525A66"; x.font = `700 10px ${MONO}`; x.textAlign = "left";
      x.fillText(`LAST ${list.length} PLAY${list.length===1?"":"S"}`, PAD, y+12);
      y += LIST_HEAD_H;

      list.forEach(r => {
        drawPlaysRow(x, PAD, y, W-PAD*2, ROW_H, r);
        y += ROW_H + ROW_GAP;
      });

      // force a full synchronous readback/repaint of the finished canvas
      // before handing it to copyCanvas
      x.putImageData(x.getImageData(0, 0, cv.width, cv.height), 0, 0);
      copyCanvas(cv, `mlb-plays-${todayISO()}.png`, setPlaysCopied);
    } catch (e) {
      console.error("exportPlays failed:", e);
      setPlaysCopied("err"); setTimeout(()=>setPlaysCopied(null),2000);
    }
  };
  // expose exportPlays/playsCopied to the shared header button (same spot
  // as the calendar's copySlate icon — see App's single export button).
  // exportPlays itself is deliberately left out of the deps (same as
  // copySlate's own onReady effect above) — it's redefined every render, so
  // including it would just re-fire this effect every render too.
  useEffect(() => { if (onReady) onReady({ exportPlays, playsCopied }); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onReady, playsCopied, tags, onlyStarred, range]);

  const resBtn = (r, val, label, color) => {
    const on = r.result === val;
    return (
      <button onClick={()=>setResult(r.gamePk, on ? null : val)}
        title={on ? `Clear ${label}` : `Mark ${label}`}
        style={{ width:30, height:28, borderRadius:3, cursor:"pointer",
          border:`1px solid ${on ? color : C.rule}`,
          background: on ? color : "#fff", color: on ? "#fff" : C.inkSoft,
          fontFamily:MONO, fontSize:12, fontWeight:700 }}>{label}</button>
    );
  };

  const FILTERS = [["all","All"],["month","This month"],["lastmonth","Last month"],
    ["7d","7 days"],["30d","30 days"]];

  if (!allRows.length) {
    return (
      <div style={{ padding:"40px 8px", fontFamily:SANS, fontSize:14, color:C.inkSoft }}>
        No tagged games yet. Open any game on the calendar and hit <b>Play</b> to tag it — your
        plays collect here with a running record and chart.
      </div>
    );
  }

  return (
    <div>
      {/* ─────────── RECORD DASHBOARD (visually distinct) ─────────── */}
      <div style={{ border:`2px solid ${C.ink}`, borderRadius:6, overflow:"hidden",
        background:C.ink, marginBottom:26 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:10, padding:"10px 16px", flexWrap:"wrap" }}>
          <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:"0.18em",
            textTransform:"uppercase", color:"rgba(255,255,255,0.6)" }}>Track Record</span>
          {/* filters */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={()=>setOnlyStarred(v=>!v)}
              aria-label={onlyStarred ? "Showing only picked plays — click to show all" : "Show only picked plays"}
              title={onlyStarred ? "Showing only picked plays" : "Show only picked plays"}
              style={{ width:26, height:26, borderRadius:"50%", cursor:"pointer", flexShrink:0,
                border:`1px solid ${onlyStarred?"#fff":"rgba(255,255,255,0.25)"}`,
                background: onlyStarred?"#fff":"transparent", opacity: onlyStarred?1:0.55,
                display:"flex", alignItems:"center", justifyContent:"center",
                overflow:"hidden", padding: onlyStarred?2:0 }}>
              <img src={hotNutLogo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
            </button>
            <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
              {FILTERS.map(([id,lbl])=>(
                <button key={id} onClick={()=>setRange(id)} style={{ padding:"4px 9px",
                  border:`1px solid ${range===id?"#fff":"rgba(255,255,255,0.25)"}`, borderRadius:2,
                  background:range===id?"#fff":"transparent", color:range===id?C.ink:"rgba(255,255,255,0.75)",
                  fontFamily:MONO, fontSize:10, letterSpacing:"0.04em", textTransform:"uppercase",
                  cursor:"pointer" }}>{lbl}</button>))}
            </div>
          </div>
        </div>

        <div style={{ background:C.paper, padding:"16px", display:"flex", gap:20,
          flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:MONO, fontSize:38, fontWeight:700, lineHeight:1 }}>
              <span style={{ color:C.over }}>{wins}</span>
              <span style={{ color:C.ruleDark }}>–</span>
              <span style={{ color:C.under }}>{losses}</span>
            </div>
            <div style={{ fontFamily:MONO, fontSize:11, color:C.inkSoft, marginTop:4 }}>
              {rangeLabel}{pct!=null ? ` · ${pct}% win` : ""}</div>
            <div style={{ fontFamily:MONO, fontSize:10, color:C.ruleDark, marginTop:1 }}>
              {graded} graded{rows.length>graded ? ` · ${rows.length-graded} untracked` : ""}</div>
          </div>

          {/* cumulative net chart */}
          <div className="ts-record-chart" style={{ flex:1, minWidth:220, height:240 }}>
            {chartData.length < 2 ? (
              <div style={{ fontFamily:MONO, fontSize:11, color:C.ruleDark,
                display:"flex", alignItems:"center", height:"100%" }}>
                Grade at least 1 play in this range to see the trend.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top:8, right:14, bottom:0, left:0 }}>
                  <XAxis dataKey="i" type="number" domain={[0, chartData.length-1]}
                    tick={{ fontFamily:MONO, fontSize:8, fill:C.inkSoft }}
                    axisLine={{ stroke:C.rule }} tickLine={false}
                    allowDecimals={false} minTickGap={16} padding={{ left:6, right:6 }} />
                  <YAxis tick={{ fontFamily:MONO, fontSize:9, fill:C.inkSoft }}
                    axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip content={({ active, payload })=>{
                    if(!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    if (!d.result) return (
                      <div style={{ background:"#fff", border:`1px solid ${C.rule}`, borderRadius:3,
                        padding:"6px 9px", fontFamily:MONO, fontSize:11, lineHeight:1.5 }}>
                        <div style={{ color:C.inkSoft }}>Start</div>
                      </div>
                    );
                    return (
                      <div style={{ background:"#fff", border:`1px solid ${C.rule}`, borderRadius:3,
                        padding:"6px 9px", fontFamily:MONO, fontSize:11, lineHeight:1.5 }}>
                        <div style={{ color:C.inkSoft }}>#{d.i} · {d.label}
                          {d.matchup ? ` · ${d.matchup}` : ""}</div>
                        <div>{d.text}</div>
                        <div>
                          <span style={{ color:d.result==="W"?C.over:d.result==="L"?C.under:C.blue, fontWeight:700 }}>{d.result}</span>
                          <span style={{ color:C.ruleDark }}>{"  ·  net "}</span>
                          <span style={{ fontWeight:700,
                            color:d.net>0?C.over:d.net<0?C.under:C.ink }}>{d.net>0?"+":""}{d.net}</span>
                        </div>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={0} stroke={C.ruleDark} strokeDasharray="3 3" />
                  <Line type="linear" dataKey="net" stroke={C.blue} strokeWidth={2}
                    dot={(p)=>{
                      if (!dotIdx.has(p.index)) return <React.Fragment key={p.index} />;
                      return <circle key={p.index} cx={p.cx} cy={p.cy} r={2.5} fill={C.blue} />;
                    }}
                    activeDot={{ r:4 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─────────── PLAY LIST ─────────── */}
      <Eyebrow n="01">Plays · newest first{range!=="all" ? ` · ${rangeLabel.toLowerCase()}` : ""}</Eyebrow>
      {rows.length===0 ? (
        <div style={{ padding:"18px 4px", fontFamily:SANS, fontSize:13, color:C.inkSoft }}>
          {onlyStarred && allRows.some(r=>!r.starred)
            ? <>No 🌰 plays in this range. <button onClick={()=>setOnlyStarred(false)}
                style={{ font:"inherit", color:C.blue, textDecoration:"underline", cursor:"pointer",
                  border:"none", background:"transparent", padding:0 }}>Show all plays</button></>
            : "No plays in this range."}</div>
      ) : (
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:14 }}>
        {rows.map(r => {
          const graded = r.result==="W" || r.result==="L" || r.result==="P";
          const tint = r.result==="W" ? "rgba(27,127,92,0.10)"
                     : r.result==="L" ? "rgba(215,38,61,0.09)"
                     : r.result==="P" ? "rgba(43,76,126,0.09)" : "#fff";
          const edge = r.result==="W" ? C.over : r.result==="L" ? C.under
                     : r.result==="P" ? C.blue : C.rule;

          if (graded) {
            // compact one-line row so more plays fit on screen
            return (
              <div key={r.gamePk} style={{ display:"flex", alignItems:"center", gap:10,
                border:`1px solid ${C.rule}`, borderLeft:`4px solid ${edge}`, borderRadius:4,
                background:tint, padding:"5px 12px" }}>
                <PlayStarBox starred={r.starred} onToggle={()=>setStarred(r.gamePk, !r.starred)} size={20} />
                <span style={{ fontFamily:MONO, fontSize:12, fontWeight:700,
                  color: r.result==="W"?C.over:r.result==="L"?C.under:C.blue, flexShrink:0, width:14 }}>{r.result}</span>
                <span style={{ fontFamily:MONO, fontSize:10.5, fontWeight:700, color:C.inkSoft,
                  flexShrink:0, whiteSpace:"nowrap" }}>
                  {r.away && r.home ? `${TEAM_ABBR[r.awayId]||r.away}@${TEAM_ABBR[r.homeId]||r.home}` : ""}</span>
                <span style={{ fontFamily:SANS, fontSize:13, fontWeight:600, color:C.ink,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}
                  title={r.text}>{r.text}</span>
                <span style={{ fontFamily:MONO, fontSize:9.5, color:C.ruleDark, flexShrink:0,
                  whiteSpace:"nowrap", textAlign:"right" }}>
                  {r.date ? calDay(r.date).md : ""}{r.time ? ` · ${fmtTime(r.time)}` : ""}</span>
                <button onClick={()=>setResult(r.gamePk, null)} title="Undo result"
                  style={{ flexShrink:0, width:26, height:24, borderRadius:3, cursor:"pointer",
                    border:`1px solid ${C.rule}`, background:"#fff", color:C.inkSoft,
                    fontFamily:MONO, fontSize:13, lineHeight:1, padding:0 }}>↩</button>
              </div>
            );
          }

          // ungraded — full row with W/L buttons
          return (
            <div key={r.gamePk} style={{ display:"flex", alignItems:"center", gap:12,
              border:`1px solid ${C.rule}`, borderLeft:`4px solid ${edge}`, borderRadius:4,
              background:tint, padding:"10px 12px" }}>
              <PlayStarBox starred={r.starred} onToggle={()=>setStarred(r.gamePk, !r.starred)} />
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:"0.04em",
                  color:C.inkSoft }}>
                  {r.away && r.home
                    ? `${TEAM_ABBR[r.awayId]||r.away} @ ${TEAM_ABBR[r.homeId]||r.home}`
                    : "—"}</div>
                <div style={{ fontFamily:SANS, fontSize:15, fontWeight:700, marginTop:2,
                  color:C.ink, wordBreak:"break-word" }}>{r.text}</div>
              </div>
              <div style={{ fontFamily:MONO, fontSize:10, color:C.ruleDark, textAlign:"right",
                flexShrink:0, lineHeight:1.4 }}>
                <div>{r.date ? calDay(r.date).md : ""}</div>
                {r.time && <div>{fmtTime(r.time)}</div>}
              </div>
              <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                {resBtn(r, "W", "W", C.over)}
                {resBtn(r, "L", "L", C.under)}
                {resBtn(r, "P", "P", C.blue)}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// small month-grid date picker that drops down from the CALENDAR tab button
// once it's already the active tab — lets you re-anchor the whole calendar
// view to any day instead of always sitting on today.
const PICKER_W = 240, PICKER_EDGE = 8;
function MiniDatePicker({ value, onSelect, onClose, anchorRef }) {
  const [viewDate, setViewDate] = useState(() => new Date(value+"T00:00:00"));
  const ref = useRef(null);
  useEffect(() => {
    const onDocMouseDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocMouseDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Anchoring this to the button with `absolute; right:0` only held while the
  // header sat on one line. Once the nav row started wrapping on narrow
  // screens the date button moved to the left edge, and a 240px panel hanging
  // off its right edge ran straight off the side of the screen.
  //
  // So it's positioned against the VIEWPORT instead: still tucked under the
  // button's right edge where there's room, but pulled back inside whichever
  // margin it would otherwise cross. Written straight to the node in a layout
  // effect rather than through state — this has to be settled before the
  // browser paints, and it saves a render per reposition.
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const width = Math.min(PICKER_W, window.innerWidth - PICKER_EDGE*2);
      const r = anchorRef?.current?.getBoundingClientRect();
      const left = r
        ? Math.min(Math.max(PICKER_EDGE, r.right - width),
                   window.innerWidth - width - PICKER_EDGE)
        : Math.max(PICKER_EDGE, (window.innerWidth - width)/2);
      el.style.width = `${width}px`;
      el.style.left = `${left}px`;
      el.style.top = `${(r ? r.bottom : 56) + 6}px`;
      // capped so a short viewport scrolls the days rather than hiding them
      el.style.maxHeight = `${window.innerHeight - (r ? r.bottom : 56) - 6 - PICKER_EDGE}px`;
      el.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();          // 0=Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayIso = todayISO();
  const isoFor = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const cells = [];
  for (let i=0;i<startWeekday;i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const navBtn = { width:24, height:24, border:`1px solid ${C.rule}`, borderRadius:3, background:"#fff",
    color:C.ink, cursor:"pointer", fontFamily:MONO, fontSize:13, lineHeight:1,
    display:"flex", alignItems:"center", justifyContent:"center", padding:0 };

  return (
    <div ref={ref} onClick={e=>e.stopPropagation()} style={{ position:"fixed", top:0, left:0,
      visibility:"hidden",   // until the layout effect below has placed it
      zIndex:80, background:"#fff", border:`1px solid ${C.ink}`, borderRadius:6,
      boxShadow:"0 12px 32px rgba(0,0,0,0.25)", padding:10, width:PICKER_W,
      boxSizing:"border-box", overflowY:"auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <button onClick={()=>setViewDate(new Date(year, month-1, 1))} style={navBtn} aria-label="Previous month">‹</button>
        <div style={{ fontFamily:MONO, fontSize:12, fontWeight:700, letterSpacing:"0.02em" }}>
          {firstOfMonth.toLocaleDateString(undefined,{month:"long", year:"numeric"})}
        </div>
        <button onClick={()=>setViewDate(new Date(year, month+1, 1))} style={navBtn} aria-label="Next month">›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{ textAlign:"center", fontFamily:MONO, fontSize:9,
            color:C.ruleDark, textTransform:"uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((d,i) => {
          if (d==null) return <div key={i} />;
          const iso = isoFor(d);
          const isSelected = iso===value, isToday = iso===todayIso;
          return (
            <button key={i} onClick={()=>onSelect(iso)} title={iso}
              style={{ aspectRatio:"1", border: isSelected ? `1px solid ${C.ink}` : isToday ? `1px solid ${C.rematch}` : "1px solid transparent",
                borderRadius:4, background: isSelected ? C.ink : "transparent",
                color: isSelected ? "#fff" : isToday ? C.rematch : C.ink,
                fontFamily:MONO, fontSize:11, fontWeight: (isToday||isSelected) ? 700 : 400,
                cursor:"pointer" }}>{d}</button>
          );
        })}
      </div>
      <button onClick={()=>onSelect(todayIso)} style={{ marginTop:8, width:"100%", padding:"5px 0",
        border:`1px solid ${C.rule}`, borderRadius:3, background:"#fff", color:C.ink,
        fontFamily:MONO, fontSize:10, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer" }}>
        Jump to today
      </button>
    </div>
  );
}

// one row of the aggregate summary — label left, value right, monospaced
// so a column of these lines up like a scorecard.
function StatLine({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"3px 0" }}>
      <span style={{ fontFamily:SANS, fontSize:12.5, color:C.inkSoft }}>{label}</span>
      <span style={{ fontFamily:MONO, fontSize:12.5, fontWeight:700, color:C.ink }}>{value}</span>
    </div>
  );
}

/* ── SDQL panel ─────────────────────────────────────────────────────── */
const SDQL_EXAMPLES = [
  { q:"runs>5 and site=home",
    why:"the plain shape of a query — a parameter, an operator, a value" },
  { q:"p:runs=0",
    why:"p: looks back a game: every team coming off a shutout" },
  { q:"p:runs=0 and runs>4",
    why:"…and how often that team erupts the very next night" },
  { q:"streak<=-3 and site=home",
    why:"home teams carrying a losing streak of three or more into the game" },
  { q:"s:o:runs>=6",
    why:"s: walks to the starter's last start, o: to what the other side did to him" },
  { q:"o:p:runs>=10",
    why:"prefixes chain: the opponent scored 10+ in THEIR previous game" },
  { q:"smeetings=2 and o:smeetings=2",
    why:"both starters are making their third start of the season against this same lineup" },
  { q:"total7<o:total7 and W",
    why:"totalN is the running score through inning N — trailing after seven, won anyway" },
  { q:"total6=0 and W",
    why:"scoreless through six and still won it" },
  { q:"A and W @ team",
    why:"@ groups the matches — road wins, broken out by team" },
  { q:"p:runs=0 and runs>4 @ season",
    why:"widen the season range above, then group by year to see it hold up (or not)" },
];

const fmt = (v, d=2) => v==null ? "–" : v.toFixed(d);
// the season-range dropdowns in SdqlPanel
const researchSelectStyle = {
  fontFamily:MONO, fontSize:12.5, padding:"6px 8px", border:`1px solid ${C.rule}`,
  borderRadius:2, background:"#fff", color:C.ink, cursor:"pointer",
};
const sdqlCell = { fontFamily:MONO, fontSize:11.5, color:C.ink };
const sdqlDesc = { fontFamily:SANS, fontSize:12, color:C.inkSoft };
const SdqlRefRow = ({ k, v }) => (
  <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:10, padding:"3px 0" }}>
    <span style={sdqlCell}>{k}</span><span style={sdqlDesc}>{v}</span>
  </div>
);

function SdqlReference() {
  const [open, setOpen] = useState(false);
  const cell = sdqlCell, desc = sdqlDesc;
  return (
    <div style={{ border:`1px solid ${C.rule}`, borderRadius:3, marginBottom:18 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", textAlign:"left",
        padding:"9px 14px", border:"none", background:C.card, cursor:"pointer",
        fontFamily:MONO, fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase",
        color:C.inkSoft, borderRadius:3 }}>
        {open ? "▾" : "▸"} Syntax reference
      </button>
      {open && (
        <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <div style={{ ...desc, marginBottom:8 }}>
              A query is a chain of phrases joined by <code style={cell}>and</code> /
              {" "}<code style={cell}>or</code>, optionally negated with <code style={cell}>not</code>.
              One result is one <em>team-game</em>, so each game in the range is
              tested twice — once from each side. The season selector above sets
              how many years get searched; <code style={cell}>p:</code>,
              {" "}<code style={cell}>s:</code>, <code style={cell}>streak</code>,
              {" "}<code style={cell}>rest</code> and <code style={cell}>smeetings</code> all
              restart at each new season rather than reaching back over the winter.
            </div>
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.12em",
              textTransform:"uppercase", color:C.ruleDark, marginBottom:6 }}>Prefixes — chain freely, read left to right</div>
            {Object.entries(SDQL_PREFIXES).map(([k,v]) => <SdqlRefRow key={k} k={`${k}:`} v={v} />)}
            <div style={{ ...desc, marginTop:6 }}>
              <code style={cell}>p:o:runs</code> = runs the opponent scored in this team's last
              game; <code style={cell}>o:p:runs</code> = runs the opponent scored in <em>their</em> last game.
            </div>
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.12em",
              textTransform:"uppercase", color:C.ruleDark, marginBottom:6 }}>Parameters</div>
            {/* the nine inningN and nine totalN rows would swamp the list, so
                only the first of each is shown, standing for its family */}
            {Object.entries(SDQL_PARAMS)
              .filter(([k]) => !/^(inning|total)[2-9]$/.test(k))
              .map(([k,v]) => <SdqlRefRow key={k} k={k==="inning1" ? "inning1 … inning9"
                : k==="total1" ? "total1 … total9" : k}
                v={k==="inning1" ? "runs scored in that inning alone"
                  : k==="total1" ? "running score THROUGH that inning, so total7<o:total7 is \"trailing after seven\""
                  : v.desc} />)}
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.12em",
              textTransform:"uppercase", color:C.ruleDark, marginBottom:6 }}>Shortcuts</div>
            <SdqlRefRow k="H / A" v="home / away" />
            <SdqlRefRow k="W / L" v="win / loss" />
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.12em",
              textTransform:"uppercase", color:C.ruleDark, marginBottom:6 }}>Operators</div>
            <SdqlRefRow k="= != > < >= <=" v="comparison; text compares case-insensitively" />
            <SdqlRefRow k="+ - * /" v="arithmetic, so runs+o:runs is the combined score" />
            <SdqlRefRow k="in" v="membership: team in ('Yankees','Red Sox')" />
            <SdqlRefRow k="@" v="group the results: … @ team, or @ month" />
          </div>
          <div style={{ ...desc, borderTop:`1px solid ${C.rule}`, paddingTop:10 }}>
            <strong>Not available here:</strong> every betting parameter —
            {" "}<code style={cell}>line</code>, <code style={cell}>total</code>,
            {" "}<code style={cell}>moneyline</code> and the <code style={cell}>F</code>/
            <code style={cell}>D</code>/<code style={cell}>O</code>/<code style={cell}>U</code>{" "}
            shortcuts. The MLB Stats API is free and carries no market data, so those
            parse but report why instead of quietly matching nothing.
          </div>
        </div>
      )}
    </div>
  );
}

function SdqlResults({ res }) {
  if (!res) return null;
  const { total, groups, groupBy } = res;
  if (!total.games) {
    return (
      <div style={{ padding:"14px 16px", background:C.card, border:`1px solid ${C.rule}`,
        borderRadius:3, fontFamily:SANS, fontSize:13, color:C.inkSoft }}>
        0 team-games matched. Loosen a condition, or check that the season has
        enough games played yet.
      </div>
    );
  }
  const pct = total.games ? (total.wins/(total.wins+total.losses||1))*100 : 0;
  const shown = res.rows.slice(0, 200);
  return (
    <div>
      <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"12px 16px",
        background:C.card, border:`1px solid ${C.rule}`, borderRadius:3, marginBottom:14 }}>
        <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
          color:C.ruleDark, marginBottom:4 }}>
          {total.games} team-game{total.games===1?"":"s"} matched
        </div>
        <StatLine label="Record" value={`${total.wins}-${total.losses} (${pct.toFixed(1)}%)`} />
        <StatLine label="Runs scored" value={fmt(total.runs)} />
        <StatLine label="Runs allowed" value={fmt(total.oRuns)} />
        <StatLine label="Combined" value={fmt(total.combined)} />
        <StatLine label="Margin" value={(total.margin>0?"+":"") + fmt(total.margin)} />
      </div>

      {groups && (
        <div style={{ border:`1px solid ${C.rule}`, borderRadius:3, overflow:"hidden", marginBottom:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 0.8fr 1fr 0.9fr 0.9fr", gap:8,
            padding:"6px 10px", background:C.card, borderBottom:`1px solid ${C.rule}`,
            fontFamily:MONO, fontSize:9.5, letterSpacing:"0.06em", textTransform:"uppercase",
            color:C.ruleDark }}>
            <span>{groupBy.join(" · ")}</span><span>GP</span><span>Record</span>
            <span>R</span><span>RA</span>
          </div>
          <div style={{ maxHeight:300, overflowY:"auto" }}>
            {groups.map((g,i) => (
              <div key={g.key} style={{ display:"grid", gridTemplateColumns:"1.6fr 0.8fr 1fr 0.9fr 0.9fr",
                gap:8, padding:"6px 10px", borderTop: i>0 ? `1px solid ${C.rule}` : "none",
                fontFamily:SANS, fontSize:12.5, alignItems:"center" }}>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.key}</span>
                <span style={{ fontFamily:MONO, fontSize:11.5 }}>{g.games}</span>
                <span style={{ fontFamily:MONO, fontSize:11.5 }}>{g.wins}-{g.losses}</span>
                <span style={{ fontFamily:MONO, fontSize:11.5 }}>{fmt(g.runs,1)}</span>
                <span style={{ fontFamily:MONO, fontSize:11.5 }}>{fmt(g.oRuns,1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ border:`1px solid ${C.rule}`, borderRadius:3, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"0.9fr 1.3fr 0.4fr 1.3fr 0.8fr", gap:8,
          padding:"6px 10px", background:C.card, borderBottom:`1px solid ${C.rule}`,
          fontFamily:MONO, fontSize:9.5, letterSpacing:"0.06em", textTransform:"uppercase",
          color:C.ruleDark }}>
          <span>Date</span><span>Team</span><span /><span>Opponent</span><span>Score</span>
        </div>
        <div style={{ maxHeight:420, overflowY:"auto" }}>
          {shown.map((r,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"0.9fr 1.3fr 0.4fr 1.3fr 0.8fr",
              gap:8, padding:"6px 10px", borderTop: i>0 ? `1px solid ${C.rule}` : "none",
              fontFamily:SANS, fontSize:12.5, alignItems:"center" }}>
              <span style={{ fontFamily:MONO, fontSize:11 }}>{r.date.slice(5)}</span>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.team}</span>
              <span style={{ fontFamily:MONO, fontSize:10, color:C.ruleDark }}>{r.site==="home"?"vs":"@"}</span>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                color:C.inkSoft }}>{r.oTeam}</span>
              <span style={{ fontFamily:MONO, fontSize:11.5, fontWeight:700,
                color: r.win ? C.over : r.loss ? C.under : C.ink }}>
                {r.runs}-{r.oRuns==null?"–":r.oRuns}
              </span>
            </div>
          ))}
        </div>
      </div>
      {res.rows.length > shown.length && (
        <div style={{ fontFamily:SANS, fontSize:12, color:C.inkSoft, marginTop:8 }}>
          Showing the most recent {shown.length} of {res.rows.length} matches.
        </div>
      )}
    </div>
  );
}

const SDQL_YEARS = Array.from({ length: SEASON - SDQL_FIRST_SEASON + 1 },
  (_,i) => SEASON - i);   // newest first, so the common choice is at the top

function SdqlPanel() {
  const [q, setQ] = useState("p:runs=0 and runs>4");
  const [from, setFrom] = useState(SEASON);
  const [to, setTo] = useState(SEASON);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);

  const lo = Math.min(from, to), hi = Math.max(from, to);
  const spanYears = hi - lo + 1;

  const run = async () => {
    const src = q.trim();
    if (!src) { setErr("Type a query first — try one of the examples below."); return; }
    let ast;
    try { ast = sdqlParse(src); }
    catch (e) { setErr(`Syntax: ${e.message}`); setRes(null); return; }
    setBusy(true); setErr(""); setRes(null); setProgress(null);
    try {
      const rows = await loadSdqlSeasons(lo, hi, (done,total)=>setProgress({ done, total }));
      setRes(sdqlRun(ast, rows));
    } catch (e) {
      setErr(e instanceof SdqlError ? e.message
        : isNet(e.message)
          ? "Couldn't reach the MLB data service. This works from a normal browser tab with an internet connection."
          : e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Eyebrow n="01">Query</Eyebrow>
      <textarea value={q} onChange={e=>setQ(e.target.value)} rows={2} spellCheck={false}
        onKeyDown={e=>{ if (e.key==="Enter" && (e.metaKey||e.ctrlKey)) run(); }}
        style={{ ...inputStyle, width:"100%", fontFamily:MONO, resize:"vertical",
          lineHeight:1.5, marginBottom:12 }} />

      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
        marginBottom:14 }}>
        <span style={{ fontFamily:SANS, fontSize:13, color:C.inkSoft }}>Seasons</span>
        <select value={from} onChange={e=>setFrom(Number(e.target.value))} style={researchSelectStyle}>
          {SDQL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontFamily:SANS, fontSize:13, color:C.inkSoft }}>to</span>
        <select value={to} onChange={e=>setTo(Number(e.target.value))} style={researchSelectStyle}>
          {SDQL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontFamily:MONO, fontSize:11, color:C.ruleDark }}>
          {spanYears === 1 ? "1 season" : `${spanYears} seasons`}
          {spanYears > 4 && " · first run will take a while"}
        </span>
      </div>

      {err && <ErrBox>{err}</ErrBox>}

      <button onClick={run} disabled={busy} style={{ padding:"9px 20px",
        border:`1px solid ${C.ink}`, borderRadius:2, background:busy?C.rule:C.ink,
        color:busy?C.inkSoft:"#fff", fontFamily:MONO, fontSize:12.5, letterSpacing:"0.08em",
        textTransform:"uppercase", cursor:busy?"default":"pointer", marginBottom:20 }}>
        {busy
          ? (progress ? `Loading ${progress.done}/${progress.total} seasons…` : "Running…")
          : "Run query →"}
      </button>

      {res && (
        <div style={{ marginBottom:26 }}>
          <Eyebrow n="02">Results</Eyebrow>
          <SdqlResults res={res} />
        </div>
      )}

      <Eyebrow>Examples</Eyebrow>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {SDQL_EXAMPLES.map(ex => (
          <button key={ex.q} onClick={()=>{ setQ(ex.q); setErr(""); }}
            style={{ textAlign:"left", padding:"8px 11px", border:`1px solid ${C.rule}`,
              borderRadius:2, background:C.card, cursor:"pointer" }}>
            <div style={{ fontFamily:MONO, fontSize:12, color:C.ink }}>{ex.q}</div>
            <div style={{ fontFamily:SANS, fontSize:11.5, color:C.inkSoft, marginTop:3 }}>{ex.why}</div>
          </button>
        ))}
      </div>

      <SdqlReference />
    </div>
  );
}

/* ── Indicator browser ────────────────────────────────────────────────
   Pick one of the calendar's indicators and see every team-game it fires
   on. Two search spaces, because the indicators aren't all made of the
   same stuff:

   • Most are decidable from the schedule + linescore alone, so they get
     written as SDQL and run over whatever season range you choose —
     record, run averages and the full game list, same as the SDQL tab.
   • The Gauntlet and Homecoming Jinx need per-pitcher season ERAs and
     career histories, which is a fetch per pitcher per game. Across even
     one season that's thousands of requests, so those two stay scoped to
     the week the calendar has already loaded. */
const INDICATOR_CHOICES = [
  { id:"bigday", key:"bigday", kind:"runs", ...TREND_SLOTS.find(s=>s.key==="bigday"),
    sdql:"p:runs>=10" },
  { id:"shutout", key:"bigday", kind:"zero", ...SHUTOUT_LEGEND_ENTRY,
    sdql:"p:runs=0",
    sdqlNote:"Season view is the plain version — shut out last game. The " +
      "calendar box additionally wants a sub-3.50 starter today or a second " +
      "straight shutout, which needs pitcher data the season scan doesn't load." },
  { id:"late", key:"late", kind:null, ...TREND_SLOTS.find(s=>s.key==="late"),
    sdql:["p:total1<=p:o:total1","p:total2<=p:o:total2","p:total3<=p:o:total3",
          "p:total4<=p:o:total4","p:total5<=p:o:total5","p:total6<=p:o:total6",
          "p:total7<p:o:total7","p:W"].join(" and "),
    sdqlNote:"Read off the linescore: never ahead through any of the first " +
      "six innings, behind after seven, won anyway. The calendar version " +
      "tracks the lead mid-inning too, so it catches a few this misses." },
  { id:"gauntlet", key:"gauntlet", kind:null, ...TREND_SLOTS.find(s=>s.key==="gauntlet"),
    sdql:null },
  { id:"formerTeam", key:"formerTeam", kind:null, ...TREND_SLOTS.find(s=>s.key==="formerTeam"),
    sdql:null },
  { id:"echo", key:"echo", kind:null, ...TREND_SLOTS.find(s=>s.key==="echo"),
    sdql:"(p:streak>=10 and p:L) or (p:streak<=-10 and p:W)" },
  { id:"travel", key:"travel", kind:null, ...TREND_SLOTS.find(s=>s.key==="travel"),
    sdql:"p:tz<=1 and tz=3" },
];

function IndicatorBrowser({ cal }) {
  const [picked, setPicked] = useState("bigday");
  const [from, setFrom] = useState(SEASON);
  const [to, setTo] = useState(SEASON);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);

  const hits = cal?.indicatorHits;
  const choice = INDICATOR_CHOICES.find(c=>c.id===picked) || INDICATOR_CHOICES[0];
  const lo = Math.min(from,to), hi = Math.max(from,to), spanYears = hi-lo+1;

  const countFor = (c) => !hits ? null
    : hits.filter(h => h.key===c.key && (c.kind==null
        || (c.kind==="zero" ? h.kind==="zero" : h.kind!=="zero"))).length;

  const weekRows = !hits ? [] : hits
    .filter(h => h.key===choice.key && (choice.kind==null
      || (choice.kind==="zero" ? h.kind==="zero" : h.kind!=="zero")))
    .slice()
    .sort((a,b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||""));

  const pick = (id) => { setPicked(id); setRes(null); setErr(""); };

  const run = async () => {
    if (!choice.sdql) return;
    setBusy(true); setErr(""); setRes(null); setProgress(null);
    try {
      const ast = sdqlParse(choice.sdql);
      const rows = await loadSdqlSeasons(lo, hi, (done,total)=>setProgress({ done, total }));
      setRes(sdqlRun(ast, rows));
    } catch (e) {
      setErr(e instanceof SdqlError ? e.message
        : isNet(e.message)
          ? "Couldn't reach the MLB data service. This works from a normal browser tab with an internet connection."
          : e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Eyebrow n="01">Indicator</Eyebrow>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20 }}>
        {INDICATOR_CHOICES.map(c => {
          const on = c.id===picked, n = countFor(c);
          return (
            <button key={c.id} onClick={()=>pick(c.id)} title={c.desc}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px",
                border:`1px solid ${on?C.ink:C.rule}`, borderRadius:2,
                background:on?C.ink:"transparent", cursor:"pointer" }}>
              <span style={{ width:9, height:9, borderRadius:2, background:c.color,
                flexShrink:0 }} />
              <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:"0.04em",
                textTransform:"uppercase", color:on?"#fff":C.ink }}>{c.label}</span>
              {n!=null && (
                <span style={{ fontFamily:MONO, fontSize:10,
                  color:on?"rgba(255,255,255,0.65)":C.ruleDark }}>{n}</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ fontFamily:SANS, fontSize:12.5, color:C.inkSoft, marginBottom:20 }}>
        {choice.desc}
      </div>

      {choice.sdql ? (
        <>
          <Eyebrow n="02">Seasons</Eyebrow>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
            marginBottom:14 }}>
            <select value={from} onChange={e=>{setFrom(Number(e.target.value)); setRes(null);}}
              style={researchSelectStyle}>
              {SDQL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ fontFamily:SANS, fontSize:13, color:C.inkSoft }}>to</span>
            <select value={to} onChange={e=>{setTo(Number(e.target.value)); setRes(null);}}
              style={researchSelectStyle}>
              {SDQL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ fontFamily:MONO, fontSize:11, color:C.ruleDark }}>
              {spanYears===1 ? "1 season" : `${spanYears} seasons`}
              {spanYears>4 && " · first run will take a while"}
            </span>
          </div>

          <div style={{ fontFamily:MONO, fontSize:11.5, color:C.ink, background:C.card,
            border:`1px solid ${C.rule}`, borderRadius:3, padding:"8px 11px",
            marginBottom:12, overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
            {choice.sdql}
          </div>
          {choice.sdqlNote && (
            <div style={{ fontFamily:SANS, fontSize:11.5, color:C.ruleDark, marginBottom:14 }}>
              {choice.sdqlNote}
            </div>
          )}

          {err && <ErrBox>{err}</ErrBox>}

          <button onClick={run} disabled={busy} style={{ padding:"9px 20px",
            border:`1px solid ${C.ink}`, borderRadius:2, background:busy?C.rule:C.ink,
            color:busy?C.inkSoft:"#fff", fontFamily:MONO, fontSize:12.5,
            letterSpacing:"0.08em", textTransform:"uppercase",
            cursor:busy?"default":"pointer", marginBottom:22 }}>
            {busy
              ? (progress ? `Loading ${progress.done}/${progress.total} seasons…` : "Running…")
              : "Get record →"}
          </button>

          {res && (
            <>
              <Eyebrow n="03">Record</Eyebrow>
              <SdqlResults res={res} />
            </>
          )}
        </>
      ) : (
        <>
          <Eyebrow n="02">This week</Eyebrow>
          <div style={{ padding:"11px 14px", background:C.card, border:`1px solid ${C.rule}`,
            borderRadius:3, fontFamily:SANS, fontSize:12, color:C.inkSoft, marginBottom:14 }}>
            No season range for this one. It needs each pitcher's season ERA or
            career history — a fetch per pitcher per game — so it stays scoped to
            the week the calendar has loaded. The day picker in the header moves
            that week.
          </div>
          {!hits ? (
            <div style={{ padding:"14px 16px", background:C.card, border:`1px solid ${C.rule}`,
              borderRadius:3, fontFamily:SANS, fontSize:13, color:C.inkSoft }}>
              Open the calendar tab once so the week's indicators load, then come back.
            </div>
          ) : !weekRows.length ? (
            <div style={{ padding:"14px 16px", background:C.card, border:`1px solid ${C.rule}`,
              borderRadius:3, fontFamily:SANS, fontSize:13, color:C.inkSoft }}>
              No team in the loaded week hits this one.
            </div>
          ) : (
            <div style={{ border:`1px solid ${C.rule}`, borderRadius:3, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"0.8fr 1fr 1.4fr 0.9fr", gap:8,
                padding:"6px 10px", background:C.card, borderBottom:`1px solid ${C.rule}`,
                fontFamily:MONO, fontSize:9.5, letterSpacing:"0.06em", textTransform:"uppercase",
                color:C.ruleDark }}>
                <span>Date</span><span>Team</span><span>Game</span><span>Result</span>
              </div>
              <div style={{ maxHeight:520, overflowY:"auto" }}>
                {weekRows.map((h,i) => (
                  <div key={`${h.gamePk}-${h.teamId}`} style={{ display:"grid",
                    gridTemplateColumns:"0.8fr 1fr 1.4fr 0.9fr", gap:8, padding:"6px 10px",
                    borderTop: i>0 ? `1px solid ${C.rule}` : "none",
                    fontFamily:SANS, fontSize:12.5, alignItems:"center" }}>
                    <span style={{ fontFamily:MONO, fontSize:11 }}>{h.date.slice(5)}</span>
                    <span style={{ fontWeight:700 }}>{h.abbr}</span>
                    <span style={{ fontFamily:MONO, fontSize:11, color:C.inkSoft }}>
                      {h.away} @ {h.home}
                    </span>
                    <span style={{ fontFamily:MONO, fontSize:11.5 }}>
                      {h.isFinal && h.awayScore!=null && h.homeScore!=null
                        ? (() => {
                            const own = h.isHome ? h.homeScore : h.awayScore;
                            const opp = h.isHome ? h.awayScore : h.homeScore;
                            const won = own > opp;
                            return <span style={{ color: won ? C.over : own<opp ? C.under : C.ink,
                              fontWeight:700 }}>{won?"W":"L"} {own}-{opp}</span>;
                          })()
                        : <span style={{ color:C.ruleDark }}>—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResearchTab({ cal }) {
  const [mode, setMode] = useState("sdql");

  const modeBtn = (key, label) => (
    <button key={key} onClick={()=>setMode(key)} style={{ padding:"6px 14px",
      border:`1px solid ${mode===key?C.ink:C.rule}`, borderRadius:2,
      background:mode===key?C.ink:"transparent", color:mode===key?"#fff":C.inkSoft,
      fontFamily:MONO, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase",
      cursor:"pointer" }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {modeBtn("sdql","SDQL")}
        {modeBtn("indicators","Indicators")}
      </div>
      {mode==="sdql" ? <SdqlPanel /> : <IndicatorBrowser cal={cal} />}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("calendar");
  const { tags, tagStatus, setTag, setResult, setStarred } = useTags();
  const [cal, setCal] = useState(null);   // { load, busy } from TravelTrends
  const [playsApi, setPlaysApi] = useState(null);   // { exportPlays, playsCopied } from TagsView
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateBtnRef = useRef(null);   // the date picker positions itself off this

  useEffect(() => {
    document.title = "MLB";
  }, []);

  // one shared camera-icon export button in the header — same look on both
  // tabs, wired to whichever tab's own export function is currently active
  const exportFn = tab==="calendar" ? cal?.copySlate : tab==="tags" ? playsApi?.exportPlays : null;
  const exportStatus = tab==="calendar" ? cal?.slateCopied : tab==="tags" ? playsApi?.playsCopied : null;
  const exportTitle = exportStatus==="empty"
    ? (tab==="calendar" ? "No tagged picks today — hit Play on a game first" : "No plays in this range to export")
    : exportStatus==="err" ? "Copy failed — try again"
    : tab==="calendar" ? "Copy today's slate with tagged picks" : "Export record, chart, and last 10 plays";

  return (
    <div className="ts-app" style={{ minHeight:"100vh", background:C.paper, color:C.ink, fontFamily:SANS }}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={{ maxWidth:1260, margin:"0 auto" }}>
        <header style={{ borderBottom:`2px solid ${C.ink}`, paddingBottom:14, marginBottom:6 }}>
          <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:"0.22em",
            textTransform:"uppercase", color:C.inkSoft }}>
            Terminal · MLB live
            {NOTES_URL && <span style={{ color:C.ruleDark }}> · tags {
              tagStatus==="loading" ? "syncing…" : tagStatus==="saving" ? "saving…"
              : tagStatus==="saved" ? "synced" : tagStatus==="error" ? "offline" : ""}</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            gap:16, flexWrap:"wrap", marginTop:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <h1 style={{ margin:0, fontFamily:SANS, fontWeight:800, fontSize:34,
                letterSpacing:"-0.02em", lineHeight:1 }}>MLB</h1>
              {exportFn && (
                <button onClick={()=>exportFn()}
                  aria-label={tab==="calendar" ? "Copy today's slate" : "Export track record"}
                  title={exportTitle}
                  style={{ width:30, height:30, borderRadius:5,
                    border:`1px solid ${exportStatus==="ok"?C.over
                      : (exportStatus==="empty"||exportStatus==="err") ? C.under : C.ink}`,
                    background:exportStatus==="ok"?C.over
                      : (exportStatus==="empty"||exportStatus==="err") ? C.under : "#fff",
                    color:exportStatus==="ok"||exportStatus==="empty"||exportStatus==="err" ? "#fff" : C.ink,
                    cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                    padding:0 }}>
                  {exportStatus==="ok" ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (exportStatus==="empty" || exportStatus==="err") ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke={C.ink} strokeWidth="2"/>
                      <path d="M8 7l1.5-2.5h5L16 7" stroke={C.ink} strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="12" cy="14" r="3.2" stroke={C.ink} strokeWidth="2"/>
                    </svg>
                  )}
                </button>
              )}
              {tab==="calendar" && cal && cal.setShowIndicators && (
                <button onClick={()=>cal.setShowIndicators(v=>!v)}
                  aria-label={cal.showIndicators ? "Hide indicators" : "Show indicators"}
                  title={cal.showIndicators ? "Hide indicators" : "Show indicators"}
                  style={{ width:30, height:30, borderRadius:5,
                    border:`1px solid ${C.ink}`,
                    background: cal.showIndicators ? "#fff" : C.ink,
                    color: cal.showIndicators ? C.ink : "#fff", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                    padding:0 }}>
                  {cal.showIndicators ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <div style={{ position:"relative" }}>
                <button ref={dateBtnRef} onClick={()=>{
                    if (tab!=="calendar") { setTab("calendar"); setShowDatePicker(false); return; }
                    setShowDatePicker(v=>!v);
                  }}
                  title={tab==="calendar" ? "Click again to jump to a different day" : "Calendar"}
                  style={{ padding:"7px 15px",
                    border:`1px solid ${tab==="calendar"?C.ink:C.rule}`, borderRadius:2,
                    background:tab==="calendar"?C.ink:"transparent", color:tab==="calendar"?"#fff":C.inkSoft,
                    fontFamily:MONO, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase",
                    cursor:"pointer" }}>
                  {cal && cal.anchor
                    ? new Date(cal.anchor+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}).toUpperCase()
                    : "CALENDAR"}
                </button>
                {showDatePicker && tab==="calendar" && cal && cal.setAnchor && (
                  <MiniDatePicker value={cal.anchor} anchorRef={dateBtnRef}
                    onSelect={(iso)=>{ cal.setAnchor(iso); setShowDatePicker(false); }}
                    onClose={()=>setShowDatePicker(false)} />
                )}
              </div>
              <button onClick={()=>{ setTab("tags"); setShowDatePicker(false); }} style={{ padding:"7px 15px",
                border:`1px solid ${tab==="tags"?C.ink:C.rule}`, borderRadius:2,
                background:tab==="tags"?C.ink:"transparent", color:tab==="tags"?"#fff":C.inkSoft,
                fontFamily:MONO, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase",
                cursor:"pointer" }}>PLAYS</button>
              <button onClick={()=>{ setTab("research"); setShowDatePicker(false); }} style={{ padding:"7px 15px",
                border:`1px solid ${tab==="research"?C.ink:C.rule}`, borderRadius:2,
                background:tab==="research"?C.ink:"transparent", color:tab==="research"?"#fff":C.inkSoft,
                fontFamily:MONO, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase",
                cursor:"pointer" }}>RESEARCH</button>
            </div>
          </div>
        </header>
        <div style={{ height:6, borderBottom:`1px solid ${C.rule}`, marginBottom:18 }} />

        {/* both views stay mounted always — hidden with CSS rather than
            unmounted — so switching tabs never throws away the calendar's
            already-loaded schedule/stats and forces a refetch */}
        <div style={{ display: tab==="tags" ? "block" : "none" }}>
          <TagsView tags={tags} setResult={setResult} setStarred={setStarred} onReady={setPlaysApi} />
        </div>
        <div style={{ display: tab==="calendar" ? "block" : "none" }}>
          <TravelTrends tags={tags} setTag={setTag} onReady={setCal} />
        </div>
        <div style={{ display: tab==="research" ? "block" : "none" }}>
          <ResearchTab cal={cal} />
        </div>

        <footer style={{ marginTop:40, paddingTop:14, borderTop:`1px solid ${C.rule}`,
          fontFamily:MONO, fontSize:10.5, color:C.ruleDark, lineHeight:1.7 }}>
          Stats & schedule: MLB Stats API (free, no key). Click any game for lineups, the
          probable starters’ history vs the opponent, and the season head-to-head. Lineups are
          confirmed only a few hours pre-game; before that they’re projected from each team’s
          last batting order.
        </footer>
      </div>
      {tab==="calendar" && cal && !cal.modalOpen && (
        <button onClick={()=>cal.load && cal.load()} disabled={cal.busy}
          aria-label="Refresh" title="Refresh schedule & stats"
          style={{ position:"fixed", bottom:20, right:20, zIndex:40,
            width:44, height:44, borderRadius:"50%", border:`1px solid ${C.ink}`,
            background:C.ink, color:"#fff", cursor:cal.busy?"default":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            padding:0, boxShadow:"0 4px 14px rgba(0,0,0,0.3)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            style={{ animation: cal.busy ? "ts-spin 0.8s linear infinite" : "none" }}>
            <path d="M4 6.5A8 8 0 0 1 19 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M20 3.5V8h-4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 17.5A8 8 0 0 1 5 16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M4 20.5V16h4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
