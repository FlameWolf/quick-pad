# Auto-prune Old Revisions

```ts
import { google, drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

// ---- Constants -------------------------------------------------------------

export const MAX_KEEP_FOREVER = 200; // Google's hard cap on pinned revisions per file
export const SAFETY_BUDGET = 199; // leave one slot free for the incoming head revision

// ---- Types -----------------------------------------------------------------

export type Drive = drive_v3.Drive;
export type Revision = drive_v3.Schema$Revision;

export interface PruneResult {
	removed: number;
	ids?: string[];
}

export interface UpdateAndPinOptions {
	/** Unpin old revisions (recoverable ~30d) instead of hard-deleting them. */
	unpin?: boolean;
}

// ---- Client ----------------------------------------------------------------

export function createDriveClient(auth: OAuth2Client): Drive {
	return google.drive({ version: "v3", auth });
}

// ---- Core logic ------------------------------------------------------------

/**
 * Lists ALL revisions of a file, following pagination.
 * Returns them sorted oldest -> newest by modifiedTime.
 */
export async function listAllRevisions(drive: Drive, fileId: string): Promise<Revision[]> {
	const revisions: Revision[] = [];
	let pageToken: string | undefined;

	do {
		const { data } = await drive.revisions.list({
			fileId,
			pageSize: 1000,
			// `list` defaults omit keepForever — request it explicitly.
			fields: "nextPageToken, revisions(id, keepForever, modifiedTime, size)",
			pageToken
		});

		if (data.revisions) revisions.push(...data.revisions);
		pageToken = data.nextPageToken ?? undefined;
	} while (pageToken);

	// Never trust list order — sort ascending by modifiedTime.
	revisions.sort((a, b) => new Date(a.modifiedTime ?? 0).getTime() - new Date(b.modifiedTime ?? 0).getTime());

	return revisions;
}

/**
 * Ensures there is room for at least one new pinned revision by removing the
 * OLDEST pinned revisions beyond `budget`. The head revision is always protected.
 */
export async function prunePinnedRevisions(drive: Drive, fileId: string, budget: number = SAFETY_BUDGET, unpinInsteadOfDelete = false): Promise<PruneResult> {
	const all = await listAllRevisions(drive, fileId);
	const headId = all.at(-1)?.id;

	// Oldest -> newest pinned revisions, excluding the head.
	const pinned = all.filter(r => r.keepForever === true && r.id !== headId);

	const excess = pinned.length - budget;
	if (excess <= 0) return { removed: 0 };

	const toRemove = pinned.slice(0, excess);

	for (const rev of toRemove) {
		if (!rev.id) continue;

		if (unpinInsteadOfDelete) {
			await drive.revisions.update({
				fileId,
				revisionId: rev.id,
				requestBody: { keepForever: false }
			});
		} else {
			await drive.revisions.delete({ fileId, revisionId: rev.id });
		}
	}

	return {
		removed: toRemove.length,
		ids: toRemove.map(r => r.id).filter((id): id is string => Boolean(id))
	};
}

/**
 * Uploads new content as the head revision and pins it, pruning old pinned
 * revisions first so we never hit the 200 cap.
 */
export async function updateAndPin(drive: Drive, fileId: string, media: drive_v3.Params$Resource$Files$Update["media"], { unpin = false }: UpdateAndPinOptions = {}): Promise<drive_v3.Schema$File> {
	// 1. Make room BEFORE uploading.
	await prunePinnedRevisions(drive, fileId, SAFETY_BUDGET, unpin);

	// 2. Upload + pin the new head revision.
	try {
		const { data } = await drive.files.update({
			fileId,
			media,
			keepRevisionForever: true, // <-- the flag you asked about
			fields: "id, headRevisionId"
		});
		return data;
	} catch (err) {
		// 3. Fallback: if we still hit the cap, aggressively prune once and retry.
		if (isKeepForeverLimitError(err)) {
			await prunePinnedRevisions(drive, fileId, SAFETY_BUDGET - 5, unpin);
			const { data } = await drive.files.update({
				fileId,
				media,
				keepRevisionForever: true,
				fields: "id, headRevisionId"
			});
			return data;
		}
		throw err;
	}
}

// ---- Error helper ----------------------------------------------------------

/** Type guard for the "too many pinned revisions" family of errors. */
export function isKeepForeverLimitError(err: unknown): boolean {
	const e = err as {
		errors?: Array<{ reason?: string }>;
		message?: string;
	};
	const reason = e?.errors?.[0]?.reason ?? e?.message ?? "";
	return /revisionsCountExceeded|limit|keepForever/i.test(reason);
}
```