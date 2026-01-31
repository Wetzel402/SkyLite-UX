## 2026-10-23 - Over-fetching in Todo Columns

**Learning:** The `todo-columns` API was returning all todos nested within each column, while the `todos` API was also fetching all todos separately. The frontend only used the `todos` API data to render the list, ignoring the nested todos in `todo-columns`. This resulted in double-fetching all todo data.
**Action:** When working with relation-heavy data (like Kanban boards), verify if the frontend consumes the nested data or joins it client-side. Removing unused `include` relations can significantly reduce payload size and DB load.
