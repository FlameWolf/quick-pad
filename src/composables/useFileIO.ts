import { useNotesStore } from "@/stores/notes";
import { useNotificationsStore } from "@/stores/notifications";
import { NoteModel } from "@/models/NoteModel";
import { isTextFile } from "@/utils/file-detection";
import { emptyString } from "@/constants/common";

interface ImportError {
	fileName: string;
	message: string;
}

const JSZip = (await import("jszip")).default;
const notesStore = useNotesStore();
const { addNotification } = useNotificationsStore();

function formatImportErrors(errors: ImportError[]): string {
	return [`Import failed for the following file`, errors.length === 1 ? emptyString : "s", ":<hr/>", `<ul>${errors.map(err => `<li>${err.fileName}: ${err.message}</li>`).join(emptyString)}</ul>`].join(emptyString);
}

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	setTimeout(() => {
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	});
}

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]+/g, "_").trim() || "Untitled";
}

function importFiles(): Promise<number> {
	return new Promise(resolve => {
		const errors: ImportError[] = [];
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.addEventListener("change", async () => {
			const files = input.files;
			if (!files || files.length === 0) {
				resolve(0);
				return;
			}
			let count = 0;
			for (const file of files) {
				if (!(await isTextFile(file))) {
					errors.push({
						fileName: file.name,
						message: "Unsupported file type"
					});
					continue;
				}
				try {
					const content = await file.text();
					const title = file.name.replace(/\.txt$/i, emptyString) || "Untitled";
					const note = new NoteModel(title, content);
					await notesStore.addNote(note);
					count++;
				} catch (err) {
					errors.push({
						fileName: file.name,
						message: "Failed to read file"
					});
				}
			}
			if (errors.length) {
				addNotification("danger", formatImportErrors(errors));
			}
			resolve(count);
		});
		input.click();
	});
}

async function exportNote(note: NoteModel) {
	const content = (await notesStore.getNoteContent(note.id)) ?? emptyString;
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	triggerDownload(blob, `${sanitizeFilename(note.title)}.txt`);
}

async function exportNotes(notes: NoteModel[]) {
	if (notes.length === 0) {
		return;
	}
	const zip = new JSZip();
	const usedNames = new Set<string>();
	for (const note of notes) {
		let name = sanitizeFilename(note.title);
		let uniqueName = name;
		let counter = 1;
		while (usedNames.has(uniqueName)) {
			uniqueName = `${name} (${counter++})`;
		}
		usedNames.add(uniqueName);
		const content = (await notesStore.getNoteContent(note.id)) ?? emptyString;
		zip.file(`${uniqueName}.txt`, content);
	}
	const blob = await zip.generateAsync({ type: "blob" });
	triggerDownload(blob, "quick-pad-notes.zip");
}

async function exportAllNotes() {
	await exportNotes(notesStore.activeNotes.value);
}

export function useFileIO() {
	return {
		importFiles,
		exportNote,
		exportNotes,
		exportAllNotes
	};
}