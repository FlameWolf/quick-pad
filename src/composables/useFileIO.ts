import JSZip from "jszip";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]+/g, "_").trim() || "Untitled";
}

export function useFileIO() {
	const store = useNotesStore();

	function importFiles(): Promise<number> {
		return new Promise((resolve) => {
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = true;
			input.accept = ".txt,text/plain";

			input.addEventListener("change", async () => {
				const files = input.files;
				if (!files || files.length === 0) {
					resolve(0);
					return;
				}

				let count = 0;
				for (const file of files) {
					const content = await file.text();
					const title = file.name.replace(/\.txt$/i, "") || "Untitled";
					const note = new NoteModel(title, content);
					store.addNote(note);
					count++;
				}
				resolve(count);
			});

			input.click();
		});
	}

	function exportNote(note: NoteModel) {
		const blob = new Blob([note.content], { type: "text/plain;charset=utf-8" });
		triggerDownload(blob, `${sanitizeFilename(note.title)}.txt`);
	}

	async function exportAllNotes() {
		const notes = store.getAllNotes();
		if (notes.length === 0) return;

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
			zip.file(`${uniqueName}.txt`, note.content);
		}

		const blob = await zip.generateAsync({ type: "blob" });
		triggerDownload(blob, "quick-pad-notes.zip");
	}

	return { importFiles, exportNote, exportAllNotes };
}
