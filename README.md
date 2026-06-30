# Hunchday

Hunchday is a daily puzzle game. Every day there are four machines. Each machine takes a handful of chips and changes them in some hidden way. Your job is to work out what each machine does.

You start with one worked example for every machine. It shows what went in and what came out. From that single example, and from whatever else you uncover yourself, you work out the rule.

## How to play

You start with the easiest machine and work your way up to the hardest. For each machine you have three ways to work: you can probe it with your own chips, you can guess what it will do to a new set, or you can write out the rule yourself. Most machines take a little probing before the pattern is clear.

## Test mode

You feed the machine your own chips and it shows you what comes out. You get two of these probes per machine, so spend them where they will teach you the most. Each probe is added to your evidence, right next to the example. You cannot probe the chips you are being asked to guess.

## Guess mode

You are shown a new set of chips going in. You lay out the chips you think will come out. A correct answer moves you closer to cracking the machine. A wrong answer shows you the real output and adds it to your evidence, and then a fresh set of chips comes in to try.

## Recipe mode

You build the rule out of small steps. You search for operations from the machine's own panel, such as keeping only the even chips or adding the chips together, and you put them in order. If your recipe reproduces everything the machine does, you have proven the rule and you crack the machine in one go.

## Cracking a machine

In guess mode you crack a machine by getting two answers right in a row. In recipe mode you crack it by writing a recipe that reproduces everything the machine does. You can afford two wrong answers across your guesses and recipes. A third wrong answer reveals the rule for you instead, so you always find out the answer.

## A new puzzle every day

The four machines change every day. Everyone who plays on the same day gets the exact same machines. The rules do not repeat, so a machine you have already seen will not come back for a long time.

## Your progress

Your game saves on its own as you play. If you close the tab and come back later the same day, you carry on from where you stopped. A fresh set of machines arrives the next day.

## Sharing

When you finish the day you get a short summary of how you did. You can copy it and pass it to friends, and it never gives away any of the answers.

## Under the hood

Hunchday is a static, serverless React app with no backend, no database, no API. The day's puzzle is a pure deterministic function of the calendar date, precomputed at build time.

### The puzzle engine

The intellectual core is a typed dataflow compiler in `src/engine/` that generates provably fair daily puzzles.

**Behavioral equivalence classing.** The engine enumerates ~95,000 typed pipeline combinations (up to 3 operations, every parameter value), runs each over a 40-input probe battery, and hashes the outputs into a behavioral fingerprint. Pipelines that compute the same function land in the same equivalence class. This turns expensive fairness questions into O(1) hash lookups.

**Uniqueness guarantee.** A puzzle is only published if no simpler pipeline produces identical outputs on the probe battery. Uniqueness is enforced by equivalence class comparison at generation time.

**Structural fairness theory.** A separate module (`fairness.ts`) rejects puzzles a human couldn't solve by reasoning alone, using 11 named invertibility patterns (L1-L6 information-loss patterns, C1-C5 conceptual-grind patterns) derived from the shape of the operation sequence without running it.

**Determinism as a hard guarantee.** `rng.ts` uses FNV-1a hashing with a MurmurHash3-style finalizer and a Mulberry32 generator, all integer/bitwise arithmetic, byte-identical across every JavaScript engine. A 365-day soak test (`determinism.test.ts`) pins the exact class-table size, a hash of all class keys, and the exact pipeline signatures of 10 specific dates, asserting no slot deadlocks and no rule repeats within a 90-day window.

### Stack
- React 19, TypeScript, Vite, Vitest
- Deployed on Vercel
- TypeScript across src/ and test/
