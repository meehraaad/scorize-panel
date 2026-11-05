import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phoneCallsQuery } from '@/lib/sales/phoneCalls';
import { syncPhoneCalls } from '@/lib/sales/liveCallDrafts';

/** Mounted outside route pages. One small snapshot every two seconds, never a request per timer tick. */
export default function LiveCalls({ owner }: { owner: number }) {
  const { data, isError, dataUpdatedAt } = useQuery(phoneCallsQuery(owner));
  useEffect(() => {
    if (data) syncPhoneCalls(owner, data, dataUpdatedAt, isError);
  }, [owner, data, dataUpdatedAt, isError]);
  return null;
}
