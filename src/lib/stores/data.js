import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase.js';

const CACHE_PREFIX = 'ethanos_cache_';

const DEFAULT_CATEGORIES = [
	{ id: 'cat_school', name: 'School', icon: '\u{1F4DA}', color: 'blue', weeklyHoursTarget: 15 },
	{ id: 'cat_coding', name: 'Coding', icon: '\u{1F4BB}', color: 'purple', weeklyHoursTarget: 10 },
	{ id: 'cat_fitness', name: 'Fitness', icon: '\u{1F4AA}', color: 'green', weeklyHoursTarget: 5 },
	{
		id: 'cat_projects',
		name: 'Projects',
		icon: '\u{1F528}',
		color: 'orange',
		weeklyHoursTarget: 8
	},
	{ id: 'cat_personal', name: 'Personal', icon: '\u{1F31F}', color: 'pink', weeklyHoursTarget: 5 }
];

const DEFAULT_XP = {
	totalXp: 0,
	level: 'Beginner',
	weeklyScores: [],
	streaks: {},
	achievements: []
};

const DEFAULT_SETTINGS = {
	userName: 'Ethan',
	theme: 'dark',
	focusDuration: 25,
	breakDuration: 5
};

// --- Individual writable stores ---
export const categories = writable(DEFAULT_CATEGORIES);
export const tasks = writable([]);
export const goals = writable([]);
export const schedule = writable([]);
export const focusSessions = writable([]);
export const moodEntries = writable([]);
export const notes = writable([]);
export const identityStatements = writable([]);
export const roadmapEvents = writable([]);
export const xp = writable({ ...DEFAULT_XP });
export const settings = writable({ ...DEFAULT_SETTINGS });

// Map of key name -> { store, default }
const STORE_MAP = {
	categories: { store: categories, default: DEFAULT_CATEGORIES },
	tasks: { store: tasks, default: [] },
	goals: { store: goals, default: [] },
	schedule: { store: schedule, default: [] },
	focusSessions: { store: focusSessions, default: [] },
	moodEntries: { store: moodEntries, default: [] },
	notes: { store: notes, default: [] },
	identityStatements: { store: identityStatements, default: [] },
	roadmapEvents: { store: roadmapEvents, default: [] },
	xp: { store: xp, default: DEFAULT_XP },
	settings: { store: settings, default: DEFAULT_SETTINGS }
};

// --- Persistence helpers ---

export async function saveStore(key, value) {
	// Save to localStorage cache
	try {
		localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
	} catch {
		// localStorage may be unavailable (SSR)
	}

	// Upsert to Supabase
	const { error } = await supabase
		.from('data_store')
		.upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

	if (error) {
		console.error(`saveStore(${key}):`, error.message);
	}
}

export async function loadStore(key, defaultValue) {
	// Try Supabase first
	const { data, error } = await supabase
		.from('data_store')
		.select('value')
		.eq('key', key)
		.single();

	if (!error && data) {
		// Cache in localStorage
		try {
			localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data.value));
		} catch {
			// ignore
		}
		return data.value;
	}

	// Fallback to localStorage
	try {
		const cached = localStorage.getItem(CACHE_PREFIX + key);
		if (cached !== null) {
			return JSON.parse(cached);
		}
	} catch {
		// ignore
	}

	return defaultValue;
}

export async function deleteStore(key) {
	try {
		localStorage.removeItem(CACHE_PREFIX + key);
	} catch {
		// ignore
	}

	const { error } = await supabase.from('data_store').delete().eq('key', key);

	if (error) {
		console.error(`deleteStore(${key}):`, error.message);
	}
}

// --- Initialization ---

export async function initData() {
	// Load every store key from Supabase (with fallbacks)
	for (const [key, entry] of Object.entries(STORE_MAP)) {
		const value = await loadStore(key, entry.default);
		entry.store.set(value);
	}

	// If first visit (no categories saved in DB), persist defaults
	const { data } = await supabase
		.from('data_store')
		.select('key')
		.eq('key', 'categories')
		.single();

	if (!data) {
		for (const [key, entry] of Object.entries(STORE_MAP)) {
			let currentValue;
			entry.store.subscribe((v) => (currentValue = v))();
			await saveStore(key, currentValue);
		}
	}
}

// --- Sync ---

export async function syncAll() {
	const { data, error } = await supabase.from('data_store').select('key, value');

	if (error) {
		console.error('syncAll:', error.message);
		return;
	}

	if (data) {
		for (const row of data) {
			const entry = STORE_MAP[row.key];
			if (entry) {
				entry.store.set(row.value);
				try {
					localStorage.setItem(CACHE_PREFIX + row.key, JSON.stringify(row.value));
				} catch {
					// ignore
				}
			}
		}
	}
}

// --- Import / Export ---

export function exportAll() {
	const snapshot = {};
	for (const [key, entry] of Object.entries(STORE_MAP)) {
		let value;
		entry.store.subscribe((v) => (value = v))();
		snapshot[key] = value;
	}
	const json = JSON.stringify(snapshot, null, 2);
	return new Blob([json], { type: 'application/json' });
}

export async function importAll(blob) {
	const text = await blob.text();
	const data = JSON.parse(text);

	for (const [key, value] of Object.entries(data)) {
		const entry = STORE_MAP[key];
		if (entry) {
			entry.store.set(value);
			await saveStore(key, value);
		}
	}
}
