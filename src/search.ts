export interface SearchState {
  open: boolean;
  query: string;
  current: number;
  total: number;
}

export type SearchAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "query"; query: string }
  | { type: "results"; current: number; total: number };

export const initialSearchState: SearchState = {
  open: false,
  query: "",
  current: 0,
  total: 0,
};

export function searchReducer(
  state: SearchState,
  action: SearchAction,
): SearchState {
  if (action.type === "open") return { ...state, open: true };
  if (action.type === "close") return { ...initialSearchState };
  if (action.type === "query")
    return { ...state, query: action.query, current: 0, total: 0 };
  return { ...state, current: action.current, total: action.total };
}
