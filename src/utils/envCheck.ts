/**
 * Environment Configuration Validation Utility
 * This utility verifies essential environment variables and helps debug configuration issues
 */

/**
 * Check if the required environment variables for Supabase are set
 * @returns Object containing validation results and debug information
 */
export const checkSupabaseEnv = (): {
  valid: boolean;
  missingVars: string[];
  debugInfo: string;
} => {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => {
    const value = import.meta.env[varName];
    return !value || value === 'undefined' || value === '';
  });
  
  // Generate debug info - careful not to expose full keys
  let debugInfo = 'Environment check results:\n';
  requiredVars.forEach(varName => {
    const value = import.meta.env[varName] as string;
    const status = value && value !== 'undefined' && value !== '' 
      ? 'Present' 
      : 'MISSING';
      
    // For API keys, only show the first few characters if present
    let displayValue = '';
    if (status === 'Present' && varName.includes('KEY')) {
      displayValue = `${value.substring(0, 5)}...`;
    } else if (status === 'Present') {
      // For URLs, we can show them
      displayValue = value;
    }
    
    debugInfo += `• ${varName}: ${status}${displayValue ? ` (${displayValue})` : ''}\n`;
  });
  
  // Add environment mode
  debugInfo += `• Environment: ${import.meta.env.MODE}\n`;
  
  return {
    valid: missingVars.length === 0,
    missingVars,
    debugInfo
  };
};

/**
 * Check if Vite has properly loaded the environment variables
 * This can help diagnose issues with .env file configuration
 */
export const diagnoseEnvLoading = (): string => {
  // Check if we can access any env vars at all
  const envKeyCount = Object.keys(import.meta.env).length;
  const hasBuiltInVars = !!import.meta.env.DEV !== undefined;
  
  if (envKeyCount <= 3 && hasBuiltInVars) {
    return 'Vite appears to be loading only built-in environment variables. Your .env file might not be loaded correctly.';
  }
  
  if (envKeyCount === 0) {
    return 'No environment variables detected. This indicates a serious configuration issue with Vite.';
  }
  
  return `Environment variables appear to be loading (${envKeyCount} variables detected).`;
};

/**
 * Generate a detailed report for troubleshooting environment issues
 */
export const generateEnvDebugReport = (): string => {
  const { valid, missingVars, debugInfo } = checkSupabaseEnv();
  const envLoadingStatus = diagnoseEnvLoading();
  
  let report = '-- Environment Configuration Report --\n\n';
  report += `${envLoadingStatus}\n\n`;
  report += debugInfo;
  
  if (!valid) {
    report += '\n-- ACTION REQUIRED --\n';
    report += 'Missing required environment variables:\n';
    missingVars.forEach(varName => {
      report += `• ${varName}\n`;
    });
    report += '\nPlease check your .env file and make sure it contains all required variables.';
  }
  
  return report;
};
