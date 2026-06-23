/**
 * Calcula nutrientes proporcionalmente à quantidade consumida.
 * Valores na tabela `foods` são por 100g/100ml (ou por 1 unidade quando unidade_base = 'un').
 */

export const VITAMIN_KEYS = [
  "vit_a","vit_b1","vit_b2","vit_b3","vit_b5","vit_b6","vit_b7","vit_b9","vit_b12","vit_c","vit_d","vit_e","vit_k",
] as const;
export const MINERAL_KEYS = [
  "calcio","ferro","magnesio","fosforo","potassio","zinco","selenio","sodio",
] as const;

export const VITAMIN_LABELS: Record<string,string> = {
  vit_a: "Vitamina A", vit_b1: "Vitamina B1", vit_b2: "Vitamina B2",
  vit_b3: "Vitamina B3", vit_b5: "Vitamina B5", vit_b6: "Vitamina B6",
  vit_b7: "Vitamina B7", vit_b9: "Vitamina B9", vit_b12: "Vitamina B12",
  vit_c: "Vitamina C", vit_d: "Vitamina D", vit_e: "Vitamina E", vit_k: "Vitamina K",
};
export const MINERAL_LABELS: Record<string,string> = {
  calcio: "Cálcio", ferro: "Ferro", magnesio: "Magnésio", fosforo: "Fósforo",
  potassio: "Potássio", zinco: "Zinco", selenio: "Selênio", sodio: "Sódio",
};
export const MICRO_UNITS: Record<string,string> = {
  vit_a: "µg", vit_b1: "mg", vit_b2: "mg", vit_b3: "mg", vit_b5: "mg",
  vit_b6: "mg", vit_b7: "µg", vit_b9: "µg", vit_b12: "µg", vit_c: "mg",
  vit_d: "µg", vit_e: "mg", vit_k: "µg",
  calcio: "mg", ferro: "mg", magnesio: "mg", fosforo: "mg",
  potassio: "mg", zinco: "mg", selenio: "µg", sodio: "mg",
};

export type FoodNutrients = {
  unidade_base: string;
  energia_kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  sodio: number;
} & Partial<Record<typeof VITAMIN_KEYS[number] | typeof MINERAL_KEYS[number], number | null>>;

export type ComputedNutrients = {
  calorias: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  sodio: number;
} & Record<typeof VITAMIN_KEYS[number] | typeof MINERAL_KEYS[number], number>;

function round(n: number) { return Math.round(n * 10) / 10; }

export function emptyTotals(): ComputedNutrients {
  const base: any = { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0 };
  for (const k of [...VITAMIN_KEYS, ...MINERAL_KEYS]) base[k] = 0;
  return base as ComputedNutrients;
}

export function computeNutrients(food: FoodNutrients, quantidade: number): ComputedNutrients {
  const factor = food.unidade_base === "un" ? quantidade : quantidade / 100;
  const out: any = {
    calorias: round((food.energia_kcal || 0) * factor),
    proteina: round((food.proteina || 0) * factor),
    carboidrato: round((food.carboidrato || 0) * factor),
    gordura: round((food.gordura || 0) * factor),
    fibra: round((food.fibra || 0) * factor),
  };
  for (const k of [...VITAMIN_KEYS, ...MINERAL_KEYS]) {
    out[k] = round(((food as any)[k] || 0) * factor);
  }
  return out;
}

export function sumTotals(a: ComputedNutrients, b: ComputedNutrients): ComputedNutrients {
  const out: any = {
    calorias: round(a.calorias + b.calorias),
    proteina: round(a.proteina + b.proteina),
    carboidrato: round(a.carboidrato + b.carboidrato),
    gordura: round(a.gordura + b.gordura),
    fibra: round(a.fibra + b.fibra),
  };
  for (const k of [...VITAMIN_KEYS, ...MINERAL_KEYS]) {
    out[k] = round(((a as any)[k] || 0) + ((b as any)[k] || 0));
  }
  return out;
}

export const MEAL_LABELS: Record<string, string> = {
  cafe_da_manha: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  outro: "Outro",
};

export const DEFAULT_MEAL_TYPES = ["cafe_da_manha", "almoco", "lanche", "jantar"] as const;
