import { v4 as uuidv4 } from 'uuid';

export function processThoughts(thoughts) {
  // First pass: combine fragmented thoughts
  const combinedThoughts = [];
  let currentThought = '';
  let lastId = null;

  for (const thought of thoughts) {
    currentThought += (currentThought ? ' ' : '') + thought.content;
    lastId = thought.id;
    // Check if we have a complete sentence or paragraph
    if (currentThought.endsWith('.') || currentThought.endsWith('\n')) {
      combinedThoughts.push({
        id: lastId,
        content: currentThought.trim()
      });
      currentThought = '';
      lastId = null;
    }
  }

  // Add any remaining content
  if (currentThought.trim()) {
    combinedThoughts.push({
      id: uuidv4(),
      content: currentThought.trim()
    });
  }

  // Second pass: (optional) could organize by sections/numbers if needed
  return combinedThoughts;
} 