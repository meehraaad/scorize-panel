/**
 * What a panel passes to the tasks page. The page is panel-neutral (canvas "پیگیری‌ها" has a
 * seller and a supervisor version): the sales panel passes its own today; the supervisor panel
 * passes applicant links and wording when it is built.
 */
export interface TasksConfig {
  /** Sent to the API (`?panel=`): which people and queues the page is about. */
  panel: 'sales' | 'supervisor';
  /** The panel's home ("Today"), for the back link. */
  homePath: string;
  /** The page of the person a task is about; `action` opens it with a call or message ready. */
  onContact?: (id: number, name: string, action: 'call' | 'message') => void;
  personPath: (id: number, action?: 'call' | 'message') => string;
  /** Who tasks are about, for the wording: customers (sales) or applicants (supervisor). */
  person: 'customer' | 'applicant';
}
