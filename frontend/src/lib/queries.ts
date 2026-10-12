import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AccountInfo,
  AiParsedItem,
  DailyProgress,
  Diary,
  DiaryEntry,
  Food,
  GoalHistoryEntry,
  GoalPreview,
  MealType,
  Profile,
  Recipe,
  RecipeDetail,
  SessionInfo,
  Weight
} from "./types";

export const qk = {
  profile: ["profile"] as const,
  account: ["account"] as const,
  sessions: ["sessions"] as const,
  currentGoal: ["goals", "current"] as const,
  goalHistory: ["goals", "history"] as const,
  diary: (date: string) => ["diary", date] as const,
  foods: (q: string) => ["foods", q] as const,
  recentFoods: ["foods", "recent"] as const,
  recipes: ["recipes"] as const,
  recipe: (id: string) => ["recipes", id] as const,
  weights: ["weights"] as const,
  progress: (from: string, to: string) => ["progress", from, to] as const
};

// ---- queries ---------------------------------------------------------

export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: () => api.get<Profile>("/users/me") });
export const useAccount = () => useQuery({ queryKey: qk.account, queryFn: () => api.get<AccountInfo>("/account/me") });
export const useSessions = () =>
  useQuery({ queryKey: qk.sessions, queryFn: () => api.get<SessionInfo[]>("/account/sessions"), staleTime: 0 });
export const useCurrentGoal = () =>
  useQuery({ queryKey: qk.currentGoal, queryFn: () => api.get<GoalHistoryEntry | null>("/users/me/goals/current") });
export const useGoalHistory = () =>
  useQuery({ queryKey: qk.goalHistory, queryFn: () => api.get<GoalHistoryEntry[]>("/users/me/goals/history") });
export const useDiary = (date: string) =>
  useQuery({ queryKey: qk.diary(date), queryFn: () => api.get<Diary>("/diary", { date }) });
export const useFoodSearch = (q: string) =>
  useQuery({ queryKey: qk.foods(q), queryFn: () => api.get<Food[]>("/foods", { q: q || undefined, limit: q ? 8 : 50 }), staleTime: 60_000 });
export const useRecentFoods = () => useQuery({ queryKey: qk.recentFoods, queryFn: () => api.get<Food[]>("/foods/recent") });
export const useRecipes = () => useQuery({ queryKey: qk.recipes, queryFn: () => api.get<Recipe[]>("/recipes") });
export const useRecipe = (id: string | undefined) =>
  useQuery({ queryKey: qk.recipe(id ?? ""), queryFn: () => api.get<RecipeDetail>(`/recipes/${id}`), enabled: Boolean(id) });
export const useWeights = () => useQuery({ queryKey: qk.weights, queryFn: () => api.get<Weight[]>("/weights", { limit: 60 }) });
export const useProgress = (from: string, to: string) =>
  useQuery({ queryKey: qk.progress(from, to), queryFn: () => api.get<DailyProgress>("/progress", { from, to }) });

// ---- diary mutations -------------------------------------------------

function useInvalidateDiary() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["diary"] });
    qc.invalidateQueries({ queryKey: ["progress"] });
    qc.invalidateQueries({ queryKey: qk.recentFoods });
  };
}

export function useAddFoodLog() {
  const done = useInvalidateDiary();
  return useMutation({
    mutationFn: (input: {
      foodId: string;
      quantity: number;
      meal: MealType;
      loggedAt: string;
      loggedDate: string;
      idempotencyKey: string;
    }) => api.post("/logs", input),
    onSuccess: done
  });
}

export function useLogRecipe(recipeId: string) {
  const done = useInvalidateDiary();
  return useMutation({
    mutationFn: (input: { servingsConsumed: number; meal: MealType; loggedAt: string; loggedDate: string }) =>
      api.post(`/recipes/${recipeId}/log`, input),
    onSuccess: done
  });
}

export function useUpdateEntry() {
  const done = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ entry, amount }: { entry: DiaryEntry; amount: number }) =>
      entry.kind === "FOOD"
        ? api.put(`/logs/${entry.id}`, { quantity: amount })
        : api.put(`/diary/recipe-logs/${entry.id}`, { servingsConsumed: amount }),
    onSuccess: done
  });
}

export function useDeleteEntry() {
  const done = useInvalidateDiary();
  return useMutation({
    mutationFn: (entry: DiaryEntry) =>
      entry.kind === "FOOD" ? api.delete(`/logs/${entry.id}`) : api.delete(`/diary/recipe-logs/${entry.id}`),
    onSuccess: done
  });
}

export function useAcceptAiParse(requestId: string) {
  const done = useInvalidateDiary();
  return useMutation({
    mutationFn: (items: unknown[]) => api.post(`/ai/parse/${requestId}/accept`, { items }),
    onSuccess: done
  });
}

export const useAiParse = () =>
  useMutation({
    mutationFn: (rawText: string) => api.post<{ requestId: string; items: AiParsedItem[] }>("/ai/parse", { rawText })
  });

// ---- profile & targets -----------------------------------------------

export interface ProfileUpdateInput {
  displayName?: string | null;
  dateOfBirth?: string;
  sexForCalc?: Profile["sexForCalc"];
  heightCm?: number;
  activityLevel?: Profile["activityLevel"];
  goal?: Profile["goal"];
  timezone?: string;
  unitPref?: Profile["unitPref"];
  targetWeightKg?: number | null;
}

export interface SetupInput {
  displayName?: string | null;
  dateOfBirth: string;
  sexForCalc: "MALE" | "FEMALE";
  heightCm: number;
  weightKg: number;
  activityLevel: Profile["activityLevel"];
  goal: Profile["goal"];
  targetWeightKg?: number | null;
  unitPref: Profile["unitPref"];
  timezone: string;
}

function useInvalidateTargets() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["diary"] });
    qc.invalidateQueries({ queryKey: ["progress"] });
  };
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdateInput) => api.put<Profile>("/users/me", patch),
    onSuccess: (data) => qc.setQueryData(qk.profile, data)
  });
}

export function useRecalculateGoals() {
  const done = useInvalidateTargets();
  return useMutation({ mutationFn: () => api.post<GoalHistoryEntry>("/users/me/goals/recalculate"), onSuccess: done });
}

export function usePreviewGoals() {
  return useMutation({ mutationFn: (input: SetupInput) => api.post<GoalPreview>("/users/me/goals/preview", input) });
}

export function useCompleteSetup() {
  const qc = useQueryClient();
  const done = useInvalidateTargets();
  return useMutation({
    mutationFn: (input: SetupInput) => api.post<{ profile: Profile; goal: GoalHistoryEntry }>("/users/me/setup", input),
    onSuccess: (data) => {
      qc.setQueryData(qk.profile, data.profile);
      qc.invalidateQueries({ queryKey: qk.weights });
      done();
    }
  });
}

export function useSetManualGoal() {
  const done = useInvalidateTargets();
  return useMutation({
    mutationFn: (input: { calorieTarget: number; proteinG?: number; carbG?: number; fatG?: number }) =>
      api.post<GoalHistoryEntry>("/users/me/goals/manual", input),
    onSuccess: done
  });
}

// ---- foods, recipes, weight ------------------------------------------

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

// ---- account security ------------------------------------------------

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post("/account/change-password", input)
  });

export function useChangeEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { newEmail: string; password: string }) => api.post<AccountInfo>("/account/change-email", input),
    onSuccess: (data) => qc.setQueryData(qk.account, data)
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/account/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions })
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/account/sessions/revoke-others"),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions })
  });
}
