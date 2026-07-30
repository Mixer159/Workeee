/**
 * Better Auth error codes → Czech messages.
 * One place for auth copy; screens never invent their own wording.
 */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Nesprávný e-mail nebo heslo.",
  INVALID_EMAIL: "Zadejte platnou e-mailovou adresu.",
  INVALID_PASSWORD: "Nesprávné heslo.",
  USER_ALREADY_EXISTS: "Účet s tímto e-mailem už existuje.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Účet s tímto e-mailem už existuje. Použijte jiný e-mail.",
  USER_NOT_FOUND: "Účet s tímto e-mailem neexistuje.",
  PASSWORD_TOO_SHORT: "Heslo musí mít alespoň 8 znaků.",
  PASSWORD_TOO_LONG: "Heslo je příliš dlouhé.",
  EMAIL_NOT_VERIFIED: "E-mail zatím není ověřený.",
  SESSION_EXPIRED: "Přihlášení vypršelo. Přihlaste se znovu.",
  FAILED_TO_CREATE_USER: "Účet se nepodařilo vytvořit. Zkuste to prosím znovu.",
};

export function authErrorMessage(error?: {
  code?: string;
  message?: string;
} | null): string {
  if (!error) {
    return "Něco se pokazilo. Zkuste to prosím znovu.";
  }
  if (error.code && MESSAGES[error.code]) {
    return MESSAGES[error.code];
  }
  return "Něco se pokazilo. Zkuste to prosím znovu.";
}
