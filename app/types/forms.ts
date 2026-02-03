export type FormData = Record<string, string | number>;

export type FormField = {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "textarea"
    | "password"
    | "url"
    | "color"
    | "boolean";
  placeholder?: string;
  min?: number;
  required?: boolean;
  disabled?: boolean;
  canEdit?: boolean;
  description?: string;
};

export type FormValidation = {
  isValid: boolean;
  errors: Record<string, string>;
};

export type FormState = {
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
};
