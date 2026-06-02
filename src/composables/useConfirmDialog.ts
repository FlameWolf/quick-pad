import { ref, readonly } from "vue";
import { emptyString } from "@/library";

export type ConfirmVariant = "danger" | "primary" | "warning";

export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
}

interface ConfirmState {
	visible: boolean;
	title: string;
	message: string;
	confirmText: string;
	cancelText: string;
	variant: ConfirmVariant;
}

const state = ref<ConfirmState>({
	visible: false,
	title: emptyString,
	message: emptyString,
	confirmText: "Confirm",
	cancelText: "Cancel",
	variant: "primary"
});

let resolver: ((value: boolean) => void) | null = null;

export function useConfirmDialog() {
	function confirm(options: ConfirmOptions): Promise<boolean> {
		return new Promise(resolve => {
			if (resolver) {
				resolver(false);
			}
			state.value = {
				visible: true,
				title: options.title,
				message: options.message,
				confirmText: options.confirmText ?? "Confirm",
				cancelText: options.cancelText ?? "Cancel",
				variant: options.variant ?? "primary"
			};
			resolver = resolve;
		});
	}

	function onConfirm() {
		const r = resolver;
		resolver = null;
		state.value = { ...state.value, visible: false };
		if (r) {
			r(true);
		}
	}

	function onCancel() {
		const r = resolver;
		resolver = null;
		state.value = { ...state.value, visible: false };
		if (r) {
			r(false);
		}
	}

	return {
		state: readonly(state),
		confirm,
		onConfirm,
		onCancel
	};
}