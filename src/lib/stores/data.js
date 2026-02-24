import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase.js';

const DEFAULT_CATEGORIES = [
	{ id: 'cat_school', name: 'School', icon: '\u{1F4DA}', color: 'blue', weeklyHoursTarget: 15 },
	{ id: 'cat_coding', name: 'Coding', icon: '\u{1F4BB}', color: 'purple', weeklyHoursTarget: 10 },
	{ id: 'cat_fitness', name: 'Fitness', icon: '\u{1F4AA}', color: 'green', weeklyHoursTarget: 5 },
	{ id: 'cat_projects', name: 'Projects', icon: '\u{1F528}', color: 'orange', weeklyHoursTarget: 8 },
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

// --- Persistence helpers (Supabase only, no localStorage) ---

export async function saveStore(key, value) {
	console.log(`[EthanOS] saveStore("${key}") — sending to Supabase...`);
	const { error } = await supabase
		.from('data_store')
		.upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

	if (error) {
		console.error(`[EthanOS] saveStore("${key}") FAILED:`, error.message, error.details, error.hint);
	} else {
		console.log(`[EthanOS] saveStore("${key}") — success`);
	}
}

export async function loadStore(key, defaultValue) {
	console.log(`[EthanOS] loadStore("${key}") — fetching from Supabase...`);
	const { data, error } = await supabase
		.from('data_store')
		.select('value')
		.eq('key', key)
		.single();

	if (error) {
		// PGRST116 = row not found, which is expected on first visit
		if (error.code === 'PGRST116') {
			console.log(`[EthanOS] loadStore("${key}") — not found in DB, using default`);
		} else {
			console.error(`[EthanOS] loadStore("${key}") FAILED:`, error.message, error.details, error.hint, error.code);
		}
		return defaultValue;
	}

	if (data) {
		console.log(`[EthanOS] loadStore("${key}") — loaded from Supabase`);
		return data.value;
	}

	return defaultValue;
}

export async function deleteStore(key) {
	console.log(`[EthanOS] deleteStore("${key}")...`);
	const { error } = await supabase.from('data_store').delete().eq('key', key);

	if (error) {
		console.error(`[EthanOS] deleteStore("${key}") FAILED:`, error.message);
	}
}

// --- Initialization ---

export async function initData() {
	console.log('[EthanOS] initData() — starting...');

	// Quick connection test
	const { error: testError } = await supabase.from('data_store').select('key').limit(1);
	if (testError) {
		console.error('[EthanOS] SUPABASE CONNECTION FAILED:', testError.message, testError.details, testError.hint);
		console.error('[EthanOS] Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars');
		return;
	}
	console.log('[EthanOS] Supabase connection OK');

	// Load every store key from Supabase
	for (const [key, entry] of Object.entries(STORE_MAP)) {
		const value = await loadStore(key, entry.default);
		entry.store.set(value);
	}

	// If first visit (no categories in DB), persist all defaults
	const { data } = await supabase
		.from('data_store')
		.select('key')
		.eq('key', 'categories')
		.single();

	if (!data) {
		console.log('[EthanOS] First visit detected — seeding defaults to Supabase...');
		for (const [key, entry] of Object.entries(STORE_MAP)) {
			let currentValue;
			entry.store.subscribe((v) => (currentValue = v))();
			await saveStore(key, currentValue);
		}
		console.log('[EthanOS] Defaults seeded.');
	}

	console.log('[EthanOS] initData() — complete');
}

// --- Sync ---

export async function syncAll() {
	const { data, error } = await supabase.from('data_store').select('key, value');

	if (error) {
		console.error('[EthanOS] syncAll FAILED:', error.message);
		return;
	}

	if (data) {
		for (const row of data) {
			const entry = STORE_MAP[row.key];
			if (entry) {
				entry.store.set(row.value);
			}
		}
		console.log(`[EthanOS] syncAll — synced ${data.length} keys`);
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
