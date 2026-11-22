import { createContext, use, type Dispatch } from 'react';
import { type ExecutionState, type StaffView, type updateExecution } from './data';

type ExecutionContextValue = {
  state: ExecutionState;
  role: StaffView;
  dispatch: Dispatch<Parameters<typeof updateExecution>[1]>;
  openApplicant: () => void;
};

export const ExecutionContext = createContext<ExecutionContextValue | null>(null);

export function useExecution() {
  const context = use(ExecutionContext);
  if (!context) throw new Error('Execution pages need the preview layout');
  return context;
}
