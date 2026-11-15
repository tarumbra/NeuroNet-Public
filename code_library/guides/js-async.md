---
title: Async JavaScript
blurb: Promises, async/await, and running things at the same time.
topic: JavaScript
level: Intermediate
order: 21
---

Anything that waits -- a file, the network, a timer -- gives you a
**promise**: a value that will exist later. `await` pauses *this function*
(not the program) until it does.

```js run
const sleep = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function main() {
  console.log("start");
  const a = await sleep(50, "first");
  console.log(a);
  console.log("end");
}
main();
```

## Waiting for several at once

Awaiting in a loop runs them one after another. `Promise.all` runs them
together and waits for all of them:

```js run
const sleep = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function main() {
  let t = Date.now();
  for (const ms of [100, 100, 100]) await sleep(ms);
  console.log("one by one:", Math.round((Date.now() - t) / 100) * 100, "ms");

  t = Date.now();
  await Promise.all([100, 100, 100].map((ms) => sleep(ms)));
  console.log("together:  ", Math.round((Date.now() - t) / 100) * 100, "ms");
}
main();
```

## Errors

A rejected promise is thrown at the `await`, so ordinary `try/catch`
works. `Promise.allSettled` is the version that doesn't stop at the first
failure:

```js run
const fail = async (why) => { throw new Error(why); };

async function main() {
  try {
    await fail("no network");
  } catch (e) {
    console.log("caught:", e.message);
  }
  const results = await Promise.allSettled([Promise.resolve(1), fail("bad file")]);
  console.log(results.map((r) => r.status));
}
main();
```

## The one mistake everyone makes

Forgetting `await`. `const data = loadData();` gives you a *promise*, not
the data -- and `if (data)` is then always true. If something is
mysteriously "[object Promise]", look for the missing `await`.
