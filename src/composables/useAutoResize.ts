import { onMounted, onBeforeUnmount, watch, type Ref } from "vue";

export function useAutoResize(editor: Readonly<Ref<HTMLTextAreaElement | null>>, content: Ref<string>, enabled: Ref<boolean>) {
	function adjustHeight() {
		if (CSS.supports("field-sizing", "content") || !enabled.value) {
			return;
		}
		const editorParent = editor.value?.parentElement;
		if (!editorParent) {
			return;
		}
		const editorClone = editor.value.cloneNode() as HTMLTextAreaElement;
		editorClone.classList.add("d-hidden");
		editorClone.style.setProperty("height", "auto");
		editorClone.value = content.value;
		editorParent.appendChild(editorClone);
		editor.value.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
		editorParent.removeChild(editorClone);
	}

	onMounted(() => window.addEventListener("resize", adjustHeight));
	onBeforeUnmount(() => window.removeEventListener("resize", adjustHeight));
	watch(content, adjustHeight);

	return { adjustHeight };
}