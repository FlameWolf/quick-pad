import { ref } from "vue";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import { getNoteContent } from "@/storage/db";
import { emptyString, isTextFile } from "@/library";
import JSZip from "jszip";

function resolveContent(note: NoteModel): Promise<string> {
	return note.content != null ? Promise.resolve(note.content) : getNoteContent(note.id);
}

const importErrors = ref<Array<{
	fileName: string;
	message: string;
}> | void>([]);

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

export function useFileIO() {
	const store = useNotesStore();

	function importFiles(): Promise<number> {
		return new Promise(resolve => {
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
						importErrors.value?.push({
							fileName: file.name,
							message: "Unsupported file type"
						});
						continue;
					}
					try {
						const content = await file.text();
						const title = file.name.replace(/\.txt$/i, emptyString) || "Untitled";
						const note = new NoteModel(title, content);
						await store.addNote(note);
						count++;
					} catch (err) {
						importErrors.value?.push({
							fileName: file.name,
							message: "Failed to read file"
						});
					}
				}
				resolve(count);
			});
			input.click();
		});
	}

	function dismissErrors() {
		importErrors.value = [];
	}

	async function exportNote(note: NoteModel) {
		const content = await resolveContent(note);
		const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
		triggerDownload(blob, `${sanitizeFilename(note.title)}.txt`);
	}

	async function exportNotes(notes: NoteModel[]) {
		if (notes.length === 0) {
			return;
		}
		const contents = await Promise.all(notes.map(resolveContent));
		const zip = new JSZip();
		const usedNames = new Set<string>();
		notes.forEach((note, index) => {
			let name = sanitizeFilename(note.title);
			let uniqueName = name;
			let counter = 1;
			while (usedNames.has(uniqueName)) {
				uniqueName = `${name} (${counter++})`;
			}
			usedNames.add(uniqueName);
			zip.file(`${uniqueName}.txt`, contents[index] ?? emptyString);
		});
		const blob = await zip.generateAsync({ type: "blob" });
		triggerDownload(blob, "quick-pad-notes.zip");
	}

	async function exportAllNotes() {
		await exportNotes(store.activeNotes);
	}

	return {
		importFiles,
		importErrors,
		dismissErrors,
		exportNote,
		exportNotes,
		exportAllNotes
	};
}