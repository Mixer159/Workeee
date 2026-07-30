export type OrganizationRole = "owner" | "admin" | "member";
export type MemberAccess = "full" | "limited";

export const ORGANIZATION_ROLE_LABEL: Record<OrganizationRole, string> = {
  owner: "Vlastník",
  admin: "Správce",
  member: "Člen",
};

export const ORGANIZATION_ROLE_OPTIONS: OrganizationRole[] = [
  "owner",
  "admin",
  "member",
];

/**
 * What the two access levels mean to a person, not to the database.
 * `full` also covers every project created later.
 */
export const MEMBER_ACCESS_LABEL: Record<MemberAccess, string> = {
  full: "Celá organizace",
  limited: "Jen vybrané projekty",
};
