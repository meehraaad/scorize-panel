// Imported first (main.tsx, the test setup) so every module after it sees Tehran local time.
import { installTehranTime } from './tehranTime';

installTehranTime();
