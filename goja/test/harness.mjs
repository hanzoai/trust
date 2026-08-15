// Thirty lines instead of a test framework.
//
// `it` takes a sync or async body and chains it onto ONE serial queue, so cases
// run in the order they were written and a build in one does not race a build in
// another. `settled()` is what the runner awaits; the exit hook prints the tally
// and sets the code, so a file run directly reports exactly like the suite does.

let passed = 0;
let failed = 0;
let queue = Promise.resolve();

export function it(name, fn) {
  queue = queue.then(async () => {
    try {
      await fn();
      passed++;
      console.log(`ok   - ${name}`);
    } catch (err) {
      failed++;
      const detail = String((err && err.message) || err).split("\n").join("\n       ");
      console.log(`FAIL - ${name}\n       ${detail}`);
    }
  });
  return queue;
}

export const settled = () => queue;

process.on("exit", (code) => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed && !code) process.exitCode = 1;
});
