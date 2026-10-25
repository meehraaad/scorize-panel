import { psForm } from './psForm';
import { WritingFormPage } from './WritingFormPage';

/** Personal statement information form: the SOP form's layout with its own questions. */
export default function PsFormPage() {
  return <WritingFormPage spec={psForm} />;
}
