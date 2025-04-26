/**
 * Utility functions for text comparison and diffing
 */

/**
 * A chunk of text that is either common, added, or removed
 */
export interface TextDiffChunk {
  value: string;
  type: 'common' | 'added' | 'removed';
}

/**
 * Find the longest common subsequence between two strings
 * This is used as a basis for the text diffing algorithm
 */
function findLongestCommonSubsequence(a: string, b: string): string {
  const matrix: number[][] = [];
  
  // Initialize the matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= b.length; j++) {
      matrix[i][j] = 0;
    }
  }
  
  // Fill the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }
  
  // Reconstruct the LCS
  let i = a.length;
  let j = b.length;
  let lcs = '';
  
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs = a[i - 1] + lcs;
      i--;
      j--;
    } else if (matrix[i - 1][j] > matrix[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

/**
 * Calculate the diff between two text strings
 * Returns an array of chunks with their type (common, added, or removed)
 */
export function calculateTextDiff(oldText: string, newText: string): TextDiffChunk[] {
  // For very long texts, we might want to split into lines or paragraphs
  if (oldText === newText) {
    return [{ value: oldText, type: 'common' }];
  }
  
  if (oldText === '') {
    return [{ value: newText, type: 'added' }];
  }
  
  if (newText === '') {
    return [{ value: oldText, type: 'removed' }];
  }
  
  const lcs = findLongestCommonSubsequence(oldText, newText);
  
  if (lcs === '') {
    return [
      { value: oldText, type: 'removed' },
      { value: newText, type: 'added' }
    ];
  }
  
  const result: TextDiffChunk[] = [];
  
  // Find the position of the LCS in both strings
  const oldIndex = oldText.indexOf(lcs);
  const newIndex = newText.indexOf(lcs);
  
  // Add any text before the LCS
  if (oldIndex > 0) {
    result.push({ value: oldText.substring(0, oldIndex), type: 'removed' });
  }
  
  if (newIndex > 0) {
    result.push({ value: newText.substring(0, newIndex), type: 'added' });
  }
  
  // Add the common part
  result.push({ value: lcs, type: 'common' });
  
  // Recursively diff the parts after the LCS
  const oldRest = oldText.substring(oldIndex + lcs.length);
  const newRest = newText.substring(newIndex + lcs.length);
  
  if (oldRest || newRest) {
    const restDiff = calculateTextDiff(oldRest, newRest);
    result.push(...restDiff);
  }
  
  // Merge adjacent chunks of the same type
  const mergedResult: TextDiffChunk[] = [];
  
  for (const chunk of result) {
    if (mergedResult.length > 0 && mergedResult[mergedResult.length - 1].type === chunk.type) {
      mergedResult[mergedResult.length - 1].value += chunk.value;
    } else {
      mergedResult.push({ ...chunk });
    }
  }
  
  return mergedResult;
}

/**
 * Calculate the diff between two text strings by word
 * This gives more granular results than the character-based diff
 */
export function calculateWordDiff(oldText: string, newText: string): TextDiffChunk[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // For identical texts, return the whole text as common
  if (oldText === newText) {
    return [{ value: oldText, type: 'common' }];
  }
  
  // Create a map of word frequency in old text
  const wordFreq: Record<string, number> = {};
  for (const word of oldWords) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }
  
  // Mark words as unchanged, added, or removed
  const oldWordStatus: ('common' | 'removed')[] = Array(oldWords.length).fill('removed');
  const newWordStatus: ('common' | 'added')[] = Array(newWords.length).fill('added');
  
  // First pass: mark common words
  for (let i = 0; i < newWords.length; i++) {
    const word = newWords[i];
    if (wordFreq[word] && wordFreq[word] > 0) {
      // Find the first occurrence of this word in old text that hasn't been marked as common
      for (let j = 0; j < oldWords.length; j++) {
        if (oldWords[j] === word && oldWordStatus[j] === 'removed') {
          oldWordStatus[j] = 'common';
          newWordStatus[i] = 'common';
          wordFreq[word]--;
          break;
        }
      }
    }
  }
  
  // Build the result
  const result: TextDiffChunk[] = [];
  let currentChunk: TextDiffChunk | null = null;
  
  // Process old text first (removed and common)
  for (let i = 0; i < oldWords.length; i++) {
    if (!currentChunk || currentChunk.type !== oldWordStatus[i]) {
      if (currentChunk) {
        result.push(currentChunk);
      }
      currentChunk = { value: oldWords[i], type: oldWordStatus[i] };
    } else {
      currentChunk.value += oldWords[i];
    }
  }
  
  if (currentChunk) {
    result.push(currentChunk);
    currentChunk = null;
  }
  
  // Process new text (added)
  for (let i = 0; i < newWords.length; i++) {
    if (newWordStatus[i] === 'added') {
      if (!currentChunk || currentChunk.type !== 'added') {
        if (currentChunk) {
          result.push(currentChunk);
        }
        currentChunk = { value: newWords[i], type: 'added' };
      } else {
        currentChunk.value += newWords[i];
      }
    }
  }
  
  if (currentChunk) {
    result.push(currentChunk);
  }
  
  return result;
}

/**
 * Calculate the diff between two texts by line
 * This is useful for comparing structured texts like code or legal documents
 */
export function calculateLineDiff(oldText: string, newText: string): TextDiffChunk[] {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  
  // For identical texts, return the whole text as common
  if (oldText === newText) {
    return [{ value: oldText, type: 'common' }];
  }
  
  const result: TextDiffChunk[] = [];
  
  // Simple line-by-line comparison
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : null;
    const newLine = i < newLines.length ? newLines[i] : null;
    
    if (oldLine === null) {
      // Line added
      result.push({ value: newLine + '\n', type: 'added' });
    } else if (newLine === null) {
      // Line removed
      result.push({ value: oldLine + '\n', type: 'removed' });
    } else if (oldLine === newLine) {
      // Line unchanged
      result.push({ value: oldLine + '\n', type: 'common' });
    } else {
      // Line changed
      result.push({ value: oldLine + '\n', type: 'removed' });
      result.push({ value: newLine + '\n', type: 'added' });
    }
  }
  
  return result;
}
