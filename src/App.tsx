// React is automatically imported by JSX transpilation
import { RouterProvider } from 'react-router-dom';
import router from './router';
// import { AuthProvider } from './context/AuthContext'; // Remove unused import
import './index.css';

function App() {
  return (
    // <AuthProvider> // Remove wrapper
      <RouterProvider router={router} />
    // </AuthProvider> // Remove wrapper
  );
}

export default App;
