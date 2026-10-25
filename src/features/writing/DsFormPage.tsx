import { dsForm } from './dsForm';
import { WritingFormPage } from './WritingFormPage';

/** Diversity statement information form: the SOP form's layout with its own questions. */
export default function DsFormPage() {
  return <WritingFormPage spec={dsForm} />;
}
