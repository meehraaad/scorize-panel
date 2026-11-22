export const EXECUTION_PATH = '/dev/execution';
export const CASE_PATH = `${EXECUTION_PATH}/cases/negar`;
export const ADMISSION_PATH = `${CASE_PATH}/italy`;
export const requestPath = (id: string) => `${ADMISSION_PATH}/search/${id}`;
