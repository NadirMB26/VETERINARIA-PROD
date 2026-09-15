export function limpiarUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map(limpiarUndefined) as unknown as T;
  }
  if (valor !== null && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (v !== undefined) salida[k] = limpiarUndefined(v);
    }
    return salida as T;
  }
  return valor;
}
