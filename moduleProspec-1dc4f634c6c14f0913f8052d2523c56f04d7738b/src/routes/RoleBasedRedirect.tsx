import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // En fonction du rôle de l'utilisateur, on le redirige vers le bon dashboard
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" />;
    case 'manager':
      return <Navigate to="/manager" />;
    case 'directeur':
      return <Navigate to="/directeur" />; 
    case 'backoffice':
      return <Navigate to="/backoffice" />;
    case 'commercial':
      return <Navigate to="/commercial" />; 
    default:
      return <Navigate to="/login" />;
  }
  //
};

export default RoleBasedRedirect;