/**
 * API Configuration for external services
 * Securely manages API keys and configuration using Vite environment variables
 */

// OpenAI API Configuration
export const OPENAI_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
  model: 'gpt-4-turbo',
  baseUrl: 'https://api.openai.com/v1'
};

// Validate OpenAI Configuration
const validateOpenAIConfig = (): boolean => {
  const isValid = !!OPENAI_CONFIG.apiKey && OPENAI_CONFIG.apiKey !== 'undefined';
  if (!isValid) {
    console.error('❌ OpenAI API configuration is missing or invalid. Please check your environment variables.');
  }
  return isValid;
};

// Export validation result for potential checks in the application
export const OPENAI_CONFIG_VALID = validateOpenAIConfig();
