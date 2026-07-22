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