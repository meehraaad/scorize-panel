import { useEffect } from 'react';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { restoreContactDrafts, useContactDrafts } from '@/lib/sales/contactDrafts';
import ContactWorkspace from './ContactWorkspace';
import LiveCalls from './LiveCalls';

/**
 * A seller's work over every page: live calls and the unsaved contact forms. Loaded after the page
 * (its stores are not part of the first load); it puts back this tab's drafts, minimized.
 */
export default function SalesWorkspace({ owner }: { owner: number }) {
  const drafts = useContactDrafts();
  useEffect(() => {
    restoreContactDrafts(owner);
  }, [owner]);
  return (
    <>
      {ON_SERVER.livePhoneCalls && <LiveCalls owner={owner} />}
      {drafts.owner === owner && (drafts.drafts.length > 0 || drafts.unknownCalls.length > 0) && (
        <ContactWorkspace />
      )}
    </>
  );
}
