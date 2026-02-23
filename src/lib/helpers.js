export const LEVEL_THRESHOLDS = [
	{ xp: 0, name: 'Beginner' },
	{ xp: 500, name: 'Novice' },
	{ xp: 1500, name: 'Apprentice' },
	{ xp: 3000, name: 'Journeyman' },
	{ xp: 5000, name: 'Expert' },
	{ xp: 8000, name: 'Master' },
	{ xp: 12000, name: 'Legend' }
];

export const COLOR_MAP = {
	blue: 'var(--cat-blue)',
	purple: 'var(--cat-purple)',
	green: 'var(--cat-green)',
	orange: 'var(--cat-orange)',
	pink: 'var(--cat-pink)'
};

export const BADGE_CLASS_MAP = {
	blue: 'badge-cat-blue',
	purple: 'badge-cat-purple',
	green: 'badge-cat-green',
	orange: 'badge-cat-orange',
	pink: 'badge-cat-pink'
};

export function generateId() {
	return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function formatDate(date) {
	return new Date(date).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

export function formatTime(date) {
	return new Date(date).toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

export function timeAgo(date) {
	const now = Date.now();
	const diff = now - new Date(date).getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);

	if (seconds < 60) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	if (weeks < 4) return `${weeks}w ago`;
	return formatDate(date);
}

export function debounce(fn, delay) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

export function getLevelInfo(totalXp) {
	let level = LEVEL_THRESHOLDS[0];
	let nextLevel = LEVEL_THRESHOLDS[1];

	for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
		if (totalXp >= LEVEL_THRESHOLDS[i].xp) {
			level = LEVEL_THRESHOLDS[i];
			nextLevel = LEVEL_THRESHOLDS[i + 1] || null;
			break;
		}
	}

	return { level: level.name, nextLevel: nextLevel ? nextLevel.name : null };
}

export function getCategoryColor(categories, id) {
	const cat = categories.find((c) => c.id === id);
	if (!cat) return undefined;
	return COLOR_MAP[cat.color];
}

export function getCategoryById(categories, id) {
	return categories.find((c) => c.id === id);
}

export function awardXP(xpStore, amount, reason) {
	let result;
	xpStore.update((current) => {
		const prevInfo = getLevelInfo(current.totalXp);
		const newTotalXp = current.totalXp + amount;
		const newInfo = getLevelInfo(newTotalXp);
		const leveledUp = newInfo.level !== prevInfo.level;

		result = { newXp: newTotalXp, leveledUp, newLevel: newInfo.level };

		return { ...current, totalXp: newTotalXp };
	});
	return result;
}
