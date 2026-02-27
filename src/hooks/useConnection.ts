const toolboxAPI = (window as any).toolboxAPI;

export async function getActiveConnection() {
  return toolboxAPI?.connections?.getActiveConnection?.() ?? null;
}
