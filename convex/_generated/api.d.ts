/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as fileReaper from "../fileReaper.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_commentBody from "../lib/commentBody.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_invites from "../lib/invites.js";
import type * as lib_ordering from "../lib/ordering.js";
import type * as lib_projectMembers from "../lib/projectMembers.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_taskStatuses from "../lib/taskStatuses.js";
import type * as lib_tasks from "../lib/tasks.js";
import type * as lib_validation from "../lib/validation.js";
import type * as migrations from "../migrations.js";
import type * as organizationPurge from "../organizationPurge.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as taskContent from "../taskContent.js";
import type * as taskStatuses from "../taskStatuses.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  comments: typeof comments;
  crons: typeof crons;
  fileReaper: typeof fileReaper;
  files: typeof files;
  http: typeof http;
  invites: typeof invites;
  "lib/access": typeof lib_access;
  "lib/activity": typeof lib_activity;
  "lib/auth": typeof lib_auth;
  "lib/commentBody": typeof lib_commentBody;
  "lib/files": typeof lib_files;
  "lib/invites": typeof lib_invites;
  "lib/ordering": typeof lib_ordering;
  "lib/projectMembers": typeof lib_projectMembers;
  "lib/storage": typeof lib_storage;
  "lib/taskStatuses": typeof lib_taskStatuses;
  "lib/tasks": typeof lib_tasks;
  "lib/validation": typeof lib_validation;
  migrations: typeof migrations;
  organizationPurge: typeof organizationPurge;
  organizations: typeof organizations;
  projects: typeof projects;
  taskContent: typeof taskContent;
  taskStatuses: typeof taskStatuses;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
