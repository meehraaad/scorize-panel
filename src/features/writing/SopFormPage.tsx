import { WritingFormPage } from './WritingFormPage';
import { sopForm } from './sopForm';

/** SOP information form. Design: canvas V6 section 4 "فرم اطلاعات انگیزه‌نامه". */
export default function SopFormPage() {
  return <WritingFormPage spec={sopForm} />;
}
