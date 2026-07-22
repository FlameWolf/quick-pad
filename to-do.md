# To Do

For text tags that must be **unique and case-insensitive**, the cleanest pattern is: _let IndexedDB enforce uniqueness on a normalized key, but keep the original casing for display._ IndexedDB can't do case-insensitive comparison itself — its key comparisons are strictly binary/code-point based, so `"React"` and `"react"` are two different keys. So the trick is to **normalize once, store the normalized value as the key, and store the original as a separate field.**

## The core idea

Every tag record looks like this:

```TypeScript

interface TagRecord {
	key: string; // normalized — the unique identity
	label: string; // original casing — what you show the user
}

```

- `key` is what enforces uniqueness (`"react"`)
- `label` is what you render (`"React"`)

## Normalization function

Do this in the app layer before writing. A robust version:

```TypeScript

function normalizeTag(raw: string): string {
	return raw
	.trim()
	.replace(/\s+/g, " ") // collapse internal whitespace
	.normalize("NFC") // unify Unicode equivalents (e.g. é vs e + ́)
	.toLowerCase(); // case-folding
}

```

A few notes:

- **`normalize("NFC")`** matters if users can type accented characters — otherwise two visually identical tags can have different byte sequences and slip past your uniqueness check.
- **`toLowerCase()` vs `toLocaleLowerCase()`**: stick with `toLowerCase()` unless you specifically need locale rules (e.g. the Turkish dotless-i). Locale folding makes "identity" depend on the user's locale, which you usually _don't_ want for shared tags.

## Schema: two good options

### Option A — normalized value **as the primary key** (recommended for standalone tags)

```TypeScript

const store = db.createObjectStore("tags", { keyPath: "key" });

// no separate index needed — the key itself is unique

```

The keyPath is already unique by definition, so `add()` throws a `ConstraintError` on a duplicate. Lookups by tag are direct (`store.get("react")`), no index hop. This is the simplest and best when the tag _is_ its own identity.

### Option B — auto-increment id + **unique index** (when tags link to other data)

```TypeScript

const store = db.createObjectStore("tags", { keyPath: "id", autoIncrement: true });
store.createIndex("key", "key", { unique: true });

```

Use this if you need a stable numeric id to reference tags from other object stores (e.g. a `noteTags` join). The `{ unique: true }` index still guarantees no duplicate normalized keys — `add()` fails with `ConstraintError`.

## Writing tags (uniqueness enforcement)

Use **`add()`**, not `put()`. `add()` rejects duplicates; `put()` would silently overwrite:

```TypeScript

async function addTag(db: IDBDatabase, raw: string): Promise<boolean> {
	const record: TagRecord = { key: normalizeTag(raw), label: raw.trim() };
	return new Promise((resolve, reject) => {
		const tx = db.transaction("tags", "readwrite");
		const req = tx.objectStore("tags").add(record);
		req.onsuccess = () => resolve(true); // added
		req.onerror = (e) => {
			if (req.error?.name === "ConstraintError") {
				e.preventDefault(); // stop the tx from aborting
				resolve(false); // already existed — not an error
			} else {
				reject(req.error);
			}
		};
	});
}

```

That `e.preventDefault()` is important: a `ConstraintError` will **abort the whole transaction** if you don't swallow it, which matters when you're batch-inserting multiple tags in one `tx`.

## Reading / checking existence

```TypeScript

// Option A
store.get(normalizeTag(userInput));
// Option B (via index)
store.index("key").get(normalizeTag(userInput));

```

Because the normalized key is already lowercased, existence checks and "does this tag exist?" queries are automatically case-insensitive.

---

### Quick summary

| Concern            | Approach                                              |
| ------------------ | ----------------------------------------------------- |
| Case-insensitivity | Normalize in app layer; store lowercased `key`        |
| Uniqueness         | keyPath (Option A) or `unique: true` index (Option B) |
| Display casing     | Keep original in a `label` field                      |
| Detect duplicates  | Use `add()` + catch `ConstraintError`                 |
| Unicode safety     | `normalize("NFC")` before folding                     |

**Bottom line:** yes, do the case-folding in the application — IndexedDB genuinely can't do it for you — but push the _uniqueness guarantee_ down to the store via the normalized key so you can't accidentally introduce dupes from a race between "check then insert."

Want me to wrap this into a small typed `TagStore` class (with `add`, `remove`, `getAll`, `has`) that fits an offline-first Vue/Solid app? I can also show the batch-insert variant that dedupes within a single transaction.

---

Good instinct — for tags specifically, a **key-value store is arguably the _cleaner_ fit** than a full object store, precisely because a tag's identity _is_ its key. You don't really have "records with fields" — you have a set of unique strings. Let me break down what "KV store" can mean here and when each is worth it.

## Three flavors of "key-value" — pick the right one

### 1. IndexedDB used _as_ a KV store (out-of-line keys)

This is the sweet spot. Create a store with **no keyPath**, and pass the key explicitly:

```TypeScript

const store = db.createObjectStore("tags"); // no keyPath, no autoIncrement

```

Then the normalized tag becomes the key, and the display label is the value:

```TypeScript

// key = normalized identity, value = original casing

store.add("React", normalizeTag("React")); // add(value, key)

```

Notice the argument order: **`add(value, key)`** for out-of-line stores (the reverse of what people expect). Here:

- **key** = `"react"` → enforces uniqueness for free
- **value** = `"React"` → what you display

Uniqueness, case-insensitive lookup, and existence checks all fall out naturally:

```TypeScript

store.get("react"); // → "React" or undefined
store.getAllKeys(); // → ["react", "vue", ...] normalized set
store.count(normalizeTag(input)); // → 0 or 1, i.e. "has"
store.delete("react");

```

`add()` still throws `ConstraintError` on a duplicate key, so you keep the same uniqueness guarantee as before — just without the boilerplate of a keyPath record or a unique index.

### 2. A KV _library_ on top of IndexedDB — `idb-keyval`

If you want to skip the raw IndexedDB ceremony, <https://github.com/jakearchibald/idb-keyval> (by Jake Archibald) is tiny (~600 bytes) and wraps exactly the pattern above:

```TypeScript

import { set, get, del, keys } from "idb-keyval";

await set(normalizeTag("React"), "React"); // key, value
await get("react"); // "React"
await keys(); // normalized tag set
await del("react");

```

The catch: **`set` is a `put`, not an `add`** — it silently overwrites. So "does this tag already exist?" becomes an explicit `await get(key) !== undefined` check _before_ writing, rather than catching a `ConstraintError`. For tags that's usually fine (re-adding "React" is idempotent anyway), but it's a real semantic difference from Option 1.

### 3. `localStorage` — only if the set is tiny

If you genuinely have a small, bounded tag list (say < a few hundred), you _could_ store the whole thing as one JSON blob:

```TypeScript

const tags = new Map(JSON.parse(localStorage.getItem("tags") ?? "[]"));
tags.set(normalizeTag(raw), raw.trim());
localStorage.setItem("tags", JSON.stringify([...tags]));

```

But I'd steer you away from this for anything real — it's **synchronous** (blocks the main thread), has a ~5 MB hard cap, is string-only, and you lose per-key atomicity (every write rewrites the entire blob). A `Map` keyed on the normalized string gives you the case-insensitive uniqueness in memory, but persistence is crude.

## How this compares to the object-store approach

| Aspect                                           | KV store (Option 1/2)            | Object store + index (previous answer) |
| ------------------------------------------------ | -------------------------------- | -------------------------------------- |
| Mental model                                     | "a set of unique strings"        | "records with fields"                  |
| Uniqueness                                       | Free — the key _is_ the identity | keyPath or `unique: true` index        |
| Case-insensitive lookup                          | `get(normalizedKey)` directly    | index lookup on normalized field       |
| Display casing preserved                         | value = original label           | separate `label` field                 |
| **Referencing tags from other stores**           | awkward — no stable numeric id   | auto-increment `id`                    |
| Extra metadata per tag (color, count, createdAt) | value becomes an object anyway   | natural                                |
| Boilerplate                                      | Minimal                          | More                                   |

## My recommendation

- **If tags are standalone** (just a vocabulary the user manages, referenced _by their text_ elsewhere) → go **KV, Option 1**. It's the most honest model: a set of unique strings, normalized key for identity, original value for display. Clean, minimal, exactly your use case.
- **The moment you need to attach metadata** (usage count, color, `createdAt`) or **reference a tag by a stable id** from a join store (`noteTags`) → the value stops being a plain string and you're basically rebuilding a record. At that point switch back to the **object store + `autoIncrement` id + unique index** from before.

For your offline-first note app, if notes store their tags **by text** (e.g. `note.tags: string[]`), KV is perfect. If notes store tags **by id** (a normalized many-to-many), you'll want the object-store version for the stable numeric keys.

Want me to write a small typed `TagStore` wrapper both ways — one raw-IndexedDB KV version and one `idb-keyval` version — with `add`/`has`/`remove`/`getAll` and the normalize step baked in, so you can drop whichever fits?