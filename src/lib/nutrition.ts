/**
 * Calcula nutrientes proporcionalmente à quantidade consumida.
 * Valores na tabela `foods` são por 100g/100ml (ou por 1 unidade quando unidade_base = 'un').
 */
export type FoodNutrients = {
  unidade_base: string;
  energia_kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  sodio: number;
};

export type ComputedNutrients = {
  calorias: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  sodio: number;
};

export function computeNutrients(food: FoodNutrients, quantidade: number): ComputedNutrients {
  const factor = food.unidade_base === "un" ? quantidade : quantidade / 100;
  return {
    calorias: round(food.energia_kcal * factor),
    proteina: round(food.proteina * factor),
    carboidrato: round(food.carboidrato * factor),
    gordura: round(food.gordura * factor),
    fibra: round(food.fibra * factor),
    sodio: round(food.sodio * factor),
  };
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export function emptyTotals(): ComputedNutrients {
  return { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, sodio: 0 };
}

export function sumTotals(a: ComputedNutrients, b: ComputedNutrients): ComputedNutrients {
  return {
    calorias: round(a.calorias + b.calorias),
    proteina: round(a.proteina + b.proteina),
    carboidrato: round(a.carboidrato + b.carboidrato),
    gordura: round(a.gordura + b.gordura),
    fibra: round(a.fibra + b.fibra),
    sodio: round(a.sodio + b.sodio),
  };
}

export const MEAL_LABELS: Record<string, string> = {
  cafe_da_manha: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  outro: "Outro",
};

export const DEFAULT_MEAL_TYPES = ["cafe_da_manha", "almoco", "lanche", "jantar"] as const;
