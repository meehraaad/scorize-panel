// The test deployment already opts into preview-only routes with this build flag.
export const executionPreviewEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ASSESSMENT_PREVIEW === 'true';
