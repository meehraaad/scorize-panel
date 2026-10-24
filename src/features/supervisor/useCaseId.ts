import { useParams } from 'react-router';

/** The case of the page (`files/:id`), for the layout and its tabs. */
export const useCaseId = () => Number(useParams().id);
