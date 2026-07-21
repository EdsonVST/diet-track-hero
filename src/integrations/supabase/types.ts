export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      exercise_categories: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          descricao: string | null
          equipamento: string | null
          fonte: string
          grupo_muscular: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          equipamento?: string | null
          fonte?: string
          grupo_muscular?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          equipamento?: string | null
          fonte?: string
          grupo_muscular?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "exercise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          calcio: number | null
          carboidrato: number
          categoria: string | null
          created_at: string
          energia_kcal: number
          ferro: number | null
          fibra: number
          fonte: string
          fosforo: number | null
          gordura: number
          id: string
          magnesio: number | null
          minerais: Json | null
          nome: string
          potassio: number | null
          proteina: number
          selenio: number | null
          sodio: number
          unidade_base: string
          updated_at: string
          user_id: string | null
          vit_a: number | null
          vit_b1: number | null
          vit_b12: number | null
          vit_b2: number | null
          vit_b3: number | null
          vit_b5: number | null
          vit_b6: number | null
          vit_b7: number | null
          vit_b9: number | null
          vit_c: number | null
          vit_d: number | null
          vit_e: number | null
          vit_k: number | null
          vitaminas: Json | null
          zinco: number | null
        }
        Insert: {
          calcio?: number | null
          carboidrato?: number
          categoria?: string | null
          created_at?: string
          energia_kcal?: number
          ferro?: number | null
          fibra?: number
          fonte?: string
          fosforo?: number | null
          gordura?: number
          id?: string
          magnesio?: number | null
          minerais?: Json | null
          nome: string
          potassio?: number | null
          proteina?: number
          selenio?: number | null
          sodio?: number
          unidade_base?: string
          updated_at?: string
          user_id?: string | null
          vit_a?: number | null
          vit_b1?: number | null
          vit_b12?: number | null
          vit_b2?: number | null
          vit_b3?: number | null
          vit_b5?: number | null
          vit_b6?: number | null
          vit_b7?: number | null
          vit_b9?: number | null
          vit_c?: number | null
          vit_d?: number | null
          vit_e?: number | null
          vit_k?: number | null
          vitaminas?: Json | null
          zinco?: number | null
        }
        Update: {
          calcio?: number | null
          carboidrato?: number
          categoria?: string | null
          created_at?: string
          energia_kcal?: number
          ferro?: number | null
          fibra?: number
          fonte?: string
          fosforo?: number | null
          gordura?: number
          id?: string
          magnesio?: number | null
          minerais?: Json | null
          nome?: string
          potassio?: number | null
          proteina?: number
          selenio?: number | null
          sodio?: number
          unidade_base?: string
          updated_at?: string
          user_id?: string | null
          vit_a?: number | null
          vit_b1?: number | null
          vit_b12?: number | null
          vit_b2?: number | null
          vit_b3?: number | null
          vit_b5?: number | null
          vit_b6?: number | null
          vit_b7?: number | null
          vit_b9?: number | null
          vit_c?: number | null
          vit_d?: number | null
          vit_e?: number | null
          vit_k?: number | null
          vitaminas?: Json | null
          zinco?: number | null
        }
        Relationships: []
      }
      meal_foods: {
        Row: {
          created_at: string
          food_id: string
          id: string
          meal_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          meal_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          meal_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_foods_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          data: string
          horario: string | null
          id: string
          observacao: string | null
          tipo: Database["public"]["Enums"]["meal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          tipo: Database["public"]["Enums"]["meal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["meal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_goals: {
        Row: {
          calorias: number
          carboidratos: number
          created_at: string
          fibras: number
          gorduras: number
          proteinas: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calorias?: number
          carboidratos?: number
          created_at?: string
          fibras?: number
          gorduras?: number
          proteinas?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calorias?: number
          carboidratos?: number
          created_at?: string
          fibras?: number
          gorduras?: number
          proteinas?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          altura: number | null
          created_at: string
          id: string
          idade: number | null
          nome: string | null
          objetivo: Database["public"]["Enums"]["goal_type"] | null
          peso: number | null
          updated_at: string
        }
        Insert: {
          altura?: number | null
          created_at?: string
          id: string
          idade?: number | null
          nome?: string | null
          objetivo?: Database["public"]["Enums"]["goal_type"] | null
          peso?: number | null
          updated_at?: string
        }
        Update: {
          altura?: number | null
          created_at?: string
          id?: string
          idade?: number | null
          nome?: string | null
          objetivo?: Database["public"]["Enums"]["goal_type"] | null
          peso?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          categoria: string
          created_at: string
          data: string
          id: string
          observacoes: string | null
          peso_kg: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          peso_kg?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          peso_kg?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          created_at: string
          descanso_segundos: number
          exercise_id: string
          id: string
          observacoes: string | null
          ordem: number
          repeticoes: string
          series: number
          template_id: string
        }
        Insert: {
          created_at?: string
          descanso_segundos?: number
          exercise_id: string
          id?: string
          observacoes?: string | null
          ordem?: number
          repeticoes?: string
          series?: number
          template_id: string
        }
        Update: {
          created_at?: string
          descanso_segundos?: number
          exercise_id?: string
          id?: string
          observacoes?: string | null
          ordem?: number
          repeticoes?: string
          series?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      water_goals: {
        Row: {
          meta_ml: number
          updated_at: string
          user_id: string
        }
        Insert: {
          meta_ml?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          meta_ml?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          created_at: string
          data: string
          id: string
          quantidade_ml: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          quantidade_ml: number
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          quantidade_ml?: number
          user_id?: string
        }
        Relationships: []
      }
      weekly_plan_days: {
        Row: {
          dia_semana: number
          id: string
          plan_id: string
          rotulo: string | null
          template_id: string | null
        }
        Insert: {
          dia_semana: number
          id?: string
          plan_id: string
          rotulo?: string | null
          template_id?: string | null
        }
        Update: {
          dia_semana?: number
          id?: string
          plan_id?: string
          rotulo?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plan_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          concluido: boolean
          created_at: string
          exercise_id: string
          id: string
          observacoes: string | null
          ordem: number
          peso: number | null
          repeticoes: number | null
          series: number | null
          workout_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          exercise_id: string
          id?: string
          observacoes?: string | null
          ordem?: number
          peso?: number | null
          repeticoes?: number | null
          series?: number | null
          workout_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          exercise_id?: string
          id?: string
          observacoes?: string | null
          ordem?: number
          peso?: number | null
          repeticoes?: number | null
          series?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          objetivo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          objetivo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          objetivo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          created_at: string
          data: string
          duracao_min: number | null
          finalizado_em: string | null
          horario: string | null
          id: string
          observacoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          duracao_min?: number | null
          finalizado_em?: string | null
          horario?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          duracao_min?: number | null
          finalizado_em?: string | null
          horario?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      goal_type: "emagrecimento" | "manutencao" | "ganho_massa"
      meal_type: "cafe_da_manha" | "almoco" | "lanche" | "jantar" | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      goal_type: ["emagrecimento", "manutencao", "ganho_massa"],
      meal_type: ["cafe_da_manha", "almoco", "lanche", "jantar", "outro"],
    },
  },
} as const
