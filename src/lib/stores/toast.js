import { writable } from 'svelte/store';

export const toasts = writable([]);

let toastId = 0;

export function showToast(message, type = 'info') {
	const id = ++toastId;
	toasts.update((t) => [...t, { id, message, type }]);
	setTimeout(() => {
		toasts.update((t) => t.filter((x) => x.id !== id));
	}, 3000);
}

export function dismissToast(id) {
	toasts.update((t) => t.filter((x) => x.id !== id));
}
