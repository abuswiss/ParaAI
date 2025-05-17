import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { checkSupabaseEnv } from './utils/envCheck' // Commented out - file not found
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Create a client
const queryClient = new QueryClient()

// const envCheck = checkSupabaseEnv(); // Commented out - function source not found

// if (!envCheck.valid) {
//   // Render an error message or a diagnostic component
//   // For example, you could render a simple message:
//   document.getElementById("root")!.innerHTML = `
//     <div style="padding: 20px; font-family: sans-serif;">
//       <h1>Configuration Error</h1>
//       <p>Supabase environment variables are missing or invalid.</p>
//       <p>Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.</p>
//       <ul>
//         ${envCheck.missing.map(key => `<li>Missing: ${key}</li>`).join('')}
//       </ul>
//     </div>
//   `;
// } else {
  // Environment variables are okay, render the app
  // Load Stripe with your publishable key from .env
  // Ensure VITE_STRIPE_PUBLISHABLE_KEY is set in your .env file
  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  const AppRoot: React.FC = () => {
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [stripeError, setStripeError] = useState<string | null>(null);
    const [isLoadingStripe, setIsLoadingStripe] = useState<boolean>(true);

    useEffect(() => {
      if (!stripePublishableKey) {
        console.error(
          'CRITICAL ERROR: Stripe publishable key (VITE_STRIPE_PUBLISHABLE_KEY) is not set in your .env file. Subscription features will NOT work.'
        );
        setStripeError('VITE_STRIPE_PUBLISHABLE_KEY is not set correctly.');
        setIsLoadingStripe(false);
        return;
      }

      loadStripe(stripePublishableKey)
        .then((stripeInstance) => {
          if (stripeInstance) {
            setStripe(stripeInstance);
          } else {
            // This case should ideally not happen if loadStripe resolves successfully with a nullish value
            // but good to handle. loadStripe itself might throw an error caught by .catch
            setStripeError("Failed to initialize Stripe. Instance was null.");
          }
        })
        .catch((error) => {
          console.error("Failed to load Stripe:", error);
          setStripeError(error.message || "An unknown error occurred while loading Stripe.");
        })
        .finally(() => {
          setIsLoadingStripe(false);
        });
    }, []);

    if (isLoadingStripe) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          fontSize: '1.2em'
        }}>
          Loading Stripe and Application...
        </div>
      );
    }

    if (stripeError || !stripe) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '20px',
          backgroundColor: '#fff0f0',
          color: '#333',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#d9534f', marginBottom: '15px' }}>Stripe Configuration Error</h1>
          <p style={{ fontWeight: 'bold', color: '#d9534f' }}>
            {stripeError || "Stripe could not be initialized."}
          </p>
          <p style={{ marginTop: '10px', lineHeight: '1.6' }}>
            The application cannot initialize Stripe payment features. Please ensure the <code style={{ backgroundColor: '#f9f2f4', padding: '2px 4px', borderRadius: '4px', color: '#c7254e' }}>VITE_STRIPE_PUBLISHABLE_KEY</code> environment variable is correctly set in your <code>.env</code> file and that you have restarted your development server.
          </p>
          <p style={{ marginTop: '10px'}}>
            You can find your publishable key in the Stripe Dashboard under "Developers" &gt; "API keys".
          </p>
        </div>
      );
    }

    return (
      // <React.StrictMode> // Temporarily commented out
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Elements stripe={stripe}>
            <App />
          </Elements>
        </QueryClientProvider>
      </AuthProvider>
      // </React.StrictMode> // Temporarily commented out
    );
  };

  createRoot(document.getElementById('root')!).render(<AppRoot />);
// }
