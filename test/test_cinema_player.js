/* Cinema's own player (ui/stuff/cinema-player.js, 14 Nov 2026): the parts that
   can be checked with no page: captions read from WebVTT, and the clock.
   Run: node test/test_cinema_player.js */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.log("  FAIL  " + n + (d ? "\n          " + d : "")); } };
const window = {};
new Function("window", fs.readFileSync(path.join(__dirname, "..", "ui", "stuff", "cinema-player.js"), "utf8"))(window);
const {parseVtt, fmt} = window.SS.CinemaPlayer._test;
const cues = parseVtt("WEBVTT\n\n1\n00:00:01.500 --> 00:00:03.000 align:start\n<i>Hello</i> there\n\n00:01:02.000 --> 00:01:04.250\nTwo\nlines\n");
ok("captions: times, with and without hours, cue settings ignored",
   cues.length === 2 && cues[0].start === 1.5 && cues[0].end === 3 && cues[1].start === 62 && cues[1].end === 64.25);
ok("captions: styling tags dropped, line breaks kept", cues[0].text === "Hello there" && cues[1].text === "Two\nlines");
ok("captions: nothing from nothing", parseVtt("").length === 0 && parseVtt(null).length === 0);
ok("the clock: minutes, then hours", fmt(65) === "1:05" && fmt(3725) === "1:02:05" && fmt(-3) === "0:00");
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
