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
      foods: {
        Row: {
          carboidrato: number
          categoria: string | null
          created_at: string
          energia_kcal: number
          fibra: number
          fonte: string
          gordura: number
          id: string
          minerais: Json | null
          nome: string
          proteina: number
          sodio: number
          unidade_base: string
          updated_at: string
          user_id: string | null
          vitaminas: Json | null
        }
        Insert: {
          carboidrato?: number
          categoria?: string | null
          created_at?: string
          energia_kcal?: number
          fibra?: number
          fonte?: string
          gordura?: number
          id?: string
          minerais?: Json | null
          nome: string
          proteina?: number
          sodio?: number
          unidade_base?: string
          updated_at?: string
          user_id?: string | null
          vitaminas?: Json | null
        }
        Update: {
          carboidrato?: number
          categoria?: string | null
          created_at?: string
          energia_kcal?: number
          fibra?: number
          fonte?: string
          gordura?: number
          id?: string
          minerais?: Json | null
          nome?: string
          proteina?: number
          sodio?: number
          unidade_base?: string
          updated_at?: string
          user_id?: string | null
          vitaminas?: Json | null
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
