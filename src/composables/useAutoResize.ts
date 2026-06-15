import { onMounted, onBeforeUnmount, watch, type Ref } from "vue";

export function useAutoResize(textArea: Readonly<Ref<HTMLTextAreaElement | null>>, content: Ref<string>, enabled: Ref<boolean>) {
	function adjustHeight() {
		if (CSS.supports("field-sizing", "content")) {
			return;
		}
		if (!enabled.value) {
			return;
		}
		const editor = textArea.value;
		const editorParent = editor?.parentElement;
		if (!editor || !editorParent) {
			return;
		}
		const editorClone = editor.cloneNode() as HTMLTextAreaElement;
		editorClone.classList.add("d-hidden");
		editorClone.style.setProperty("height", "auto");
		editorClone.value = content.value;
		editorParent.appendChild(editorClone);
		editor.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
		editorParent.removeChild(editorClone);
	}

	onMounted(() => window.addEventListener("resize", adjustHeight));
	onBeforeUnmount(() => window.removeEventListener("resize", adjustHeight));
	watch(content, adjustHeight);

	return { adjustHeight };
}