const adjectives = [
	"amber", "azure", "bold", "bright", "calm", "cedar", "clear", "coral",
	"crisp", "dawn", "deep", "dusty", "fern", "flint", "frost", "golden",
	"grand", "green", "iron", "ivory", "jade", "keen", "lark", "lush",
	"maple", "moss", "noble", "oak", "peak", "pine", "prime", "quiet",
	"rapid", "ridge", "river", "sage", "shore", "silver", "slate", "smooth",
	"solid", "spark", "steep", "stone", "storm", "swift", "tall", "terra",
	"thick", "true", "vast", "warm", "west", "wild", "wise", "wolf",
];

const nouns = [
	"arch", "basin", "bay", "bluff", "brook", "butte", "cairn", "canyon",
	"cape", "cliff", "cove", "creek", "crest", "dale", "dell", "drift",
	"dune", "falls", "field", "fjord", "forge", "gate", "glen", "gorge",
	"grove", "haven", "hawk", "heath", "hill", "isle", "knoll", "lake",
	"ledge", "marsh", "mesa", "mill", "mound", "notch", "pass", "peak",
	"plain", "point", "pond", "port", "range", "reef", "ridge", "rock",
	"shoal", "slope", "spring", "spur", "summit", "trail", "vale", "vista",
];

export function generateShareToken(): string {
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const noun = nouns[Math.floor(Math.random() * nouns.length)];
	const num = Math.floor(Math.random() * 90) + 10;
	return `${adj}-${noun}-${num}`;
}
