export type GoogleTasksList = {
  id: string;
  title: string;
  updated?: string | null;
};

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string | null;
  status: "needsAction" | "completed";
  due?: string | null;
  completed?: string | null;
  updated: string;
  taskListId: string;
};
