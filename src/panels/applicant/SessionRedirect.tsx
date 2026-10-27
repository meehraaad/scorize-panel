import { Navigate, useParams } from 'react-router';
import { sessionHref } from '@/lib/applicant/consultations';
import { idParam } from '@/lib/router/lazyPage';

/** An old session link (`/consultations/41`, sent by SMS) opens that session over the home. */
export function SessionRedirect() {
  const id = idParam(useParams().id);
  return <Navigate to={id === null ? '/' : sessionHref(id)} replace />;
}
