import { createContext, useContext } from 'react';
import { useParams } from 'react-router';

export const CaseIdContext = createContext<number | null>(null);

/** Executive routes carry a customer ID and provide the separately authorized applicant ID. */
export function useCaseId() {
  const caseId = useContext(CaseIdContext);
  const params = useParams();
  return caseId ?? Number(params.id);
}
