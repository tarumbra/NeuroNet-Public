---
title: JavaScript essentials
blurb: Modern JavaScript you'll use every day.
topic: JavaScript
level: Beginner
order: 20
---

## `const` by default, `let` when it changes

```js run
const total = 10;          // can't be reassigned
let count = 0;             // can
for (let i = 0; i < 3; i++) count += i;
console.log(total, count);
```

Never `var` -- its scoping is from another era.

## Destructuring and spread

```js run
const user = { name: "Cam", city: "Brisbane", theme: "dark" };
const { name, ...settings } = user;
console.log(name, settings);

const [first, second = "none"] = ["only"];
console.log(first, second);

const merged = { ...settings, theme: "light" };   // later keys win
console.log(merged);
```

## Arrays: map, filter, reduce

```js run
const sessions = [
  { day: "Mon", minutes: 45 },
  { day: "Tue", minutes: 0 },
  { day: "Wed", minutes: 60 },
];
const trained = sessions.filter((s) => s.minutes > 0).map((s) => s.day);
const total = sessions.reduce((sum, s) => sum + s.minutes, 0);
console.log(trained, total);
console.log(sessions.some((s) => s.minutes === 0), sessions.find((s) => s.minutes > 50));
```

## Optional chaining and `??`

```js run
const config = { audio: { volume: 0 } };
console.log(config.video?.width);          // undefined, not a crash
console.log(config.audio.volume || 50);     // 50 -- wrong! 0 is falsy
console.log(config.audio.volume ?? 50);     // 0 -- only null/undefined fall back
```

## Map and Set

```js run
const seen = new Set(["a", "b", "a"]);
console.log(seen.size, seen.has("b"));

const plays = new Map();
for (const song of ["x", "y", "x"]) plays.set(song, (plays.get(song) ?? 0) + 1);
console.log([...plays]);
```

Use a `Map` when keys aren't fixed names (any value can be a key, and it
remembers insertion order); use an object for a record with known fields.

## `===`, always

`==` converts types before comparing (`"1" == 1` is true). `===` doesn't.
