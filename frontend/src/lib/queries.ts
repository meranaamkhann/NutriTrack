import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AiParsedItem,
  DailyProgress,
  Food,
  FoodLog,
  GoalHistoryEntry,
  MealType,
  Profile,
  Recipe,
  RecipeDetail,
  Weight
} from "./types";

// Centralized query keys so invalidation targets are consistent everywhere
// a mutation needs to say "this data may now be stale."
export const qk = {
  profile: ["profile"] as const,
  currentGoal: ["goals", "current"] as const,
  logsForDate: (date: string) => ["logs", date] as const,
  foods: (q: string) => ["foods", q] as const,
  recipes: ["recipes"] as const,
  recipe: (id: string) => ["recipes", id] as const,
  weights: ["weights"] as const,
  progress: (from: string, to: string) => ["progress", from, to] as const
};

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: () => api.get<Profile>("/users/me") });
}

export function useCurrentGoal() {
  return useQuery({
    queryKey: qk.currentGoal,
    queryFn: () => api.get<GoalHistoryEntry | null>("/users/me/goals/current")
  });
}

export function useTodayLogs(dateIso: string) {
  return useQuery({
    queryKey: qk.logsForDate(dateIso.slice(0, 10)),
    queryFn: () => api.get<FoodLog[]>("/logs", { date: dateIso })
  });
}

export function useFoodSearch(q: string) {
  return useQuery({
    queryKey: qk.foods(q),
    queryFn: () => api.get<Food[]>("/foods", { q: q || undefined, limit: q ? 8 : 50 }),
    enabled: true,
    staleTime: 60_000
  });
}

export function useRecipes() {
  return useQuery({ queryKey: qk.recipes, queryFn: () => api.get<Recipe[]>("/recipes") });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: qk.recipe(id ?? ""),
    queryFn: () => api.get<RecipeDetail>(`/recipes/${id}`),
    enabled: Boolean(id)
  });
}

export function useWeights() {
  return useQuery({ queryKey: qk.weights, queryFn: () => api.get<Weight[]>("/weights", { limit: 60 }) });
}

export function useProgress(from: string, to: string) {
  return useQuery({
    queryKey: qk.progress(from, to),
    queryFn: () => api.get<DailyProgress>("/progress", { from, to })
  });
}

// --- Mutations -------------------------------------------------------

export function useCreateLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      foodId: string;
      quantity: number;
      meal: MealType;
      loggedAt: string;
      idempotencyKey: string;
    }) => api.post<FoodLog>("/logs", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    }
  });
}

export function useUpdateLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.put<FoodLog>(`/logs/${id}`, { quantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    }
  });
}

export function useDeleteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    }
  });
}

export interface ProfileUpdateInput {
  dateOfBirth?: string;
  sexForCalc?: Profile["sexForCalc"];
  heightCm?: number;
  activityLevel?: Profile["activityLevel"];
  goal?: Profile["goal"];
  timezone?: string;
  unitPref?: Profile["unitPref"];
  targetWeightKg?: number | null;
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdateInput) => api.put<Profile>("/users/me", patch),
    onSuccess: (data) => qc.setQueryData(qk.profile, data)
  });
}

export function useRecalculateGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<GoalHistoryEntry>("/users/me/goals/recalculate"),
    onSuccess: (data) => {
      qc.setQueryData(qk.currentGoal, data);
      qc.invalidateQueries({ queryKey: ["progress"] });
    }
  });
}

export function useCreateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Food>("/foods", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] })
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Recipe>("/recipes", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.recipes })
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.recipes })
  });
}

export function useLogRecipe(recipeId: string) {
  return useMutation({
    mutationFn: (input: { servingsConsumed: number; meal: MealType; loggedAt: string }) =>
      api.post(`/recipes/${recipeId}/log`, input)
  });
}

export function useUpsertWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { weightKg: number; recordedAt: string }) => api.post<Weight>("/weights", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.weights })
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/weights/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.weights })
  });
}

export function useAiParse() {
  return useMutation({
    mutationFn: (rawText: string) =>
      api.post<{ requestId: string; items: AiParsedItem[] }>("/ai/parse", { rawText })
  });
}

export function useAcceptAiParse(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: unknown[]) => api.post(`/ai/parse/${requestId}/accept`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] })
  });
}
