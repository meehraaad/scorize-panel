import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';

/** The page frame of the seller's customers list and of their calendar (each its own nav tab). */
export default function LeadsLayout() {
  return (
    <PageStack>
      <Outlet />
    </PageStack>
  );
}
