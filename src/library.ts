const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });
const characterSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
export const emptyString = "";
export const summaryLength = 100;
export const getSummary = (text: string): string => {
	return text.length > summaryLength ? text.substring(0, summaryLength) + "\u2026" : text;
};
export const getSentenceCount = (text: string): number => {
	return Array.from(sentenceSegmenter.segment(text)).length;
};
export const getWordCount = (text: string): number => {
	return Array.from(wordSegmenter.segment(text)).filter(segment => segment.isWordLike).length;
};
export const getCharacterCount = (text: string): number => {
	return Array.from(characterSegmenter.segment(text)).length;
};