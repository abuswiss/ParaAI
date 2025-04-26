import React, { useState, useEffect } from 'react';
import { supabase, isAuthenticated, getConnectionStatus } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * This component helps diagnose database schema issues as part of the migration from
 * Flask middleware to direct Supabase integration
 */
const DatabaseDiagnostic: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');
  const [schemaInfo, setSchemaInfo] = useState<any>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        setIsLoading(true);
        
        // Check authentication
        const authenticated = await isAuthenticated();
        setAuthStatus(authenticated);
        
        // Check connection status
        const connStatus = await getConnectionStatus();
        setConnectionStatus(connStatus);
        
        // Check schema info if authenticated
        if (authenticated) {
          await checkSchemaInfo();
        }
      } catch (error) {
        console.error('Diagnostic error:', error);
        setSchemaError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    
    runDiagnostics();
  }, [session]);
  
  const checkSchemaInfo = async () => {
    try {
      // Try listing tables
      let tableInfo = null;
      let tableError = null;
      
      try {
        const result = await supabase.rpc('schema_info', {}, { count: 'exact' });
        tableInfo = result.data;
        tableError = result.error;
      } catch (err) {
        tableError = new Error('RPC function schema_info does not exist');
      }
        
      // If RPC not available, try direct table query
      if (tableError) {
        console.log('RPC error, trying direct queries');
        
        // Try conversations table info
        const conversationsInfo = await checkTable('conversations');
        
        // Try cases table info
        const casesInfo = await checkTable('cases');
        
        // Try messages table info
        const messagesInfo = await checkTable('messages');
        
        setSchemaInfo({
          conversations: conversationsInfo,
          cases: casesInfo,
          messages: messagesInfo
        });
      } else {
        setSchemaInfo(tableInfo);
      }
    } catch (error) {
      console.error('Schema check error:', error);
      setSchemaError(error instanceof Error ? error.message : 'Unknown schema error');
    }
  };
  
  const checkTable = async (tableName: string) => {
    try {
      // Try to select one row to check if table exists
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        // Relation does not exist = table not found
        if (error.message.includes('does not exist')) {
          return {
            exists: false,
            error: `Table '${tableName}' does not exist`,
            message: error.message
          };
        }
        
        // Permission error = table exists but no access
        if (error.message.includes('permission') || error.code === '42501') {
          return {
            exists: true,
            error: `No permission to access '${tableName}'`,
            message: error.message
          };
        }
        
        // Other error
        return {
          exists: false,
          error: error.message,
          code: error.code
        };
      }
      
      // Table exists
      return {
        exists: true,
        columns: data?.length ? Object.keys(data[0]) : [],
        rowCount: data?.length || 0,
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error checking table'
      };
    }
  };
  
  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg shadow-lg max-w-4xl mx-auto my-8">
      <h1 className="text-2xl font-bold mb-4">Database Diagnostic Tool</h1>
      
      {isLoading ? (
        <div className="text-xl">Running diagnostics...</div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-2">Connection Status</h2>
            <div className="bg-gray-800 p-4 rounded">
              <p>{connectionStatus}</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
            <div className="bg-gray-800 p-4 rounded">
              {authStatus === null ? (
                <p>Unable to determine authentication status</p>
              ) : authStatus ? (
                <p className="text-green-400">Authenticated ✓</p>
              ) : (
                <p className="text-red-400">Not authenticated ✗</p>
              )}
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">Schema Information</h2>
            {schemaError ? (
              <div className="bg-red-900 p-4 rounded">
                <p className="text-red-200">Error checking schema: {schemaError}</p>
              </div>
            ) : schemaInfo ? (
              <div className="bg-gray-800 p-4 rounded">
                <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96">
                  {JSON.stringify(schemaInfo, null, 2)}
                </pre>
              </div>
            ) : (
              <p>No schema information available</p>
            )}
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">Expected Schema</h2>
            <div className="bg-gray-800 p-4 rounded">
              <pre className="whitespace-pre-wrap text-sm">
{`CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  case_id UUID REFERENCES cases(id) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL
);`}
              </pre>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">Resolution Steps</h2>
            <div className="bg-gray-800 p-4 rounded">
              <ol className="list-decimal pl-6 space-y-2">
                <li>Verify the 'conversations' table exists in your Supabase database</li>
                <li>Ensure the column structure matches the expected schema</li>
                <li>Check that Row Level Security (RLS) policies are configured correctly</li>
                <li>Verify the user has appropriate permissions to insert data</li>
                <li>If migrating from Flask, ensure proper data migration has been completed</li>
              </ol>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DatabaseDiagnostic;
