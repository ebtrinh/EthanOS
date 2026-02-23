import { writable } from 'svelte/store';

export const modalState = writable({ open: false, title: '', content: '', component: null, props: {} });

export function openModal(title, contentOrComponent, props = {}) {
	if (typeof contentOrComponent === 'string') {
		modalState.set({ open: true, title, content: contentOrComponent, component: null, props: {} });
	} else {
		modalState.set({ open: true, title, content: '', component: contentOrComponent, props });
	}
}

export function closeModal() {
	modalState.set({ open: false, title: '', content: '', component: null, props: {} });
}
