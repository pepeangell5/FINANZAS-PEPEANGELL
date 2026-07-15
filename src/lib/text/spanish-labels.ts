const labelFixes: Record<string, string> = {
  Reinversion: "Reinversión",
  "ReinversiÃ³n": "Reinversión",
  "ReinversiÃƒÂ³n": "Reinversión",
  "Operacion del negocio": "Operación del negocio",
  "OperaciÃ³n del negocio": "Operación del negocio",
  "OperaciÃƒÂ³n del negocio": "Operación del negocio",
};

export function normalizeSpanishLabel(value: string) {
  return labelFixes[value] ?? value;
}
