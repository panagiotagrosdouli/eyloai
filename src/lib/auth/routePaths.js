export function appPath(path, baseUrl = '/') {
  const normalizedBase = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  const base = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
  const relativePath = String(path || '').replace(/^\/+/, '');
  return relativePath ? `${base}${relativePath}` : base;
}

export function stripAppBase(pathname, baseUrl = '/') {
  const normalizedBase = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  const base = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
  const prefix = base === '/' ? '' : base.slice(0, -1);
  const currentPath = pathname || '/';

  if (!prefix) return currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
  if (currentPath === prefix || currentPath === base) return '/';
  return currentPath.startsWith(`${prefix}/`) ? currentPath.slice(prefix.length) : currentPath;
}
