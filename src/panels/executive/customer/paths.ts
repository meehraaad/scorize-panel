export const customerWorkspacePath = (id: number, tab = '') =>
  `/executive/customers/${String(id)}${tab ? `/${tab}` : ''}`;

export const customerWorkDeskPath = (id: number) => customerWorkspacePath(id, 'desk');
