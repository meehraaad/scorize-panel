import { useParams } from 'react-router';

/** The customer of the page (`customers/:id`), for the layout and its sub-tab pages. */
export const useCustomerId = () => Number(useParams().id);
