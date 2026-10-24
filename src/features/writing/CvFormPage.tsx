import { WritingFormPage } from './WritingFormPage';
import { cvForm } from './cvForm';

/** CV information form. Design: canvas V6 section 5 "فرم اطلاعات رزومه" (AppCv). */
export default function CvFormPage() {
  return <WritingFormPage spec={cvForm} />;
}
