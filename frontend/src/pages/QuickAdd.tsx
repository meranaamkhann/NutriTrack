import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAiParse, useAcceptAiParse } from "../lib/queries";
import type { AiParsedItem, MealType } from "../lib/types";
import { Button, ErrorText, Field, Input, PageHeader, Panel, Select } from "../components/ui";

const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

interface ReviewItem extends AiParsedItem {
  loggedAt: string;
}

export function QuickAdd() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState("");

  const parseMutation = useAiParse();
  const acceptMutation = useAcceptAiParse(requestId ?? "");

  function parse(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    parseMutation.mutate(text, {
      onSuccess: (res) => {
        setRequestId(res.requestId);
        setItems(res.items.map((it) => ({ ...it, loggedAt: new Date().toISOString() })));
        if (res.items.length === 0) {
          setError(
            "Nothing recognized. This preview build doesn't have a live model connected yet — try adding foods directly instead."
          );
        }
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not parse that")
    });
  }

  function updateItem(i: number, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function accept() {
    if (!requestId) return;
    setError("");
    acceptMutation.mutate(items, {
      // The mutation hook already invalidates the logs query cache on
      // success, so Today reflects these as soon as it's visited — without
      // that, Today would keep showing its last-cached (pre-AI-add) logs.
      onSuccess: () => navigate("/"),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save these entries")
    });
  }

  return (
    <div>
      <PageHeader
        title="Quick add"
        subtitle="Describe what you ate in plain language. You'll review every value before anything is saved — nothing here is logged automatically."
      />
      <Panel className="mb-6">
        <form onSubmit={parse} className="flex flex-col gap-4">
          <Field label="What did you eat?">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="2 eggs, 3 rotis and 150 grams chicken curry"
              maxLength={500}
            />
          </Field>
          <Button type="submit" disabled={parseMutation.isPending || !text.trim()}>
            {parseMutation.isPending ? "Reading…" : "Parse"}
          </Button>
        </form>
      </Panel>

      <ErrorText>{error}</ErrorText>

      {items.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Review before saving — these are AI estimates
          </h2>
          {items.map((item, i) => (
            <Panel key={i}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Food name">
                  <Input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} />
                </Field>
                <Field label="Meal">
                  <Select value={item.meal} onChange={(e) => updateItem(i, { meal: e.target.value as MealType })}>
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m[0] + m.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`Quantity (${item.unit.toLowerCase()})`}>
                  <Input
                    type="number"
                    step="0.1"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Estimated calories">
                  <Input
                    type="number"
                    value={item.estimatedCalories}
                    onChange={(e) => updateItem(i, { estimatedCalories: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </Panel>
          ))}
          <Button onClick={accept} disabled={acceptMutation.isPending}>
            {acceptMutation.isPending ? "Saving…" : `Save ${items.length} item${items.length > 1 ? "s" : ""} to today`}
          </Button>
        </div>
      )}
    </div>
  );
}
