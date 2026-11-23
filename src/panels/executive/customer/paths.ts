export const customerWorkspacePath = (id: number, tab = '') =>
  `/executive/customers/${String(id)}${tab ? `/${tab}` : ''}`;
