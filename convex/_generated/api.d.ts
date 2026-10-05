/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiTokens from "../apiTokens.js";
import type * as auth from "../auth.js";
import type * as bots from "../bots.js";
import type * as commentReactions from "../commentReactions.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as fileReaper from "../fileReaper.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_apiTokens from "../lib/apiTokens.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bots from "../lib/bots.js";
import type * as lib_brevo from "../lib/brevo.js";
import type * as lib_commentActions from "../lib/commentActions.js";
import type * as lib_commentBody from "../lib/commentBody.js";
import type * as lib_commentReactions from "../lib/commentReactions.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_invites from "../lib/invites.js";
import type * as lib_mcp_server from "../lib/mcp/server.js";
import type * as lib_mcp_taskText from "../lib/mcp/taskText.js";
import type * as lib_mcp_tools from "../lib/mcp/tools.js";
import type * as lib_notificationEmail from "../lib/notificationEmail.js";
import type * as lib_notificationItems from "../lib/notificationItems.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_ordering from "../lib/ordering.js";
import type * as lib_passwordResetEmail from "../lib/passwordResetEmail.js";
import type * as lib_plural from "../lib/plural.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_projectMembers from "../lib/projectMembers.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_svg from "../lib/svg.js";
import type * as lib_taskActions from "../lib/taskActions.js";
import type * as lib_taskContent from "../lib/taskContent.js";
import type * as lib_taskSeen from "../lib/taskSeen.js";
import type * as lib_taskStatuses from "../lib/taskStatuses.js";
import type * as lib_tasks from "../lib/tasks.js";
import type * as lib_validation from "../lib/validation.js";
import type * as mcp from "../mcp.js";
import type * as mcpTools from "../mcpTools.js";
import type * as migrations from "../migrations.js";
import type * as notificationItems from "../notificationItems.js";
import type * as notifications from "../notifications.js";
import type * as organizationPurge from "../organizationPurge.js";
import type * as organizations from "../organizations.js";
import type * as presence from "../presence.js";
import type * as projects from "../projects.js";
import type * as taskContent from "../taskContent.js";
import type * as taskSeen from "../taskSeen.js";
import type * as taskStatuses from "../taskStatuses.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiTokens: typeof apiTokens;
  auth: typeof auth;
  bots: typeof bots;
  commentReactions: typeof commentReactions;
  comments: typeof comments;
  crons: typeof crons;
  fileReaper: typeof fileReaper;
  files: typeof files;
  http: typeof http;
  invites: typeof invites;
  "lib/access": typeof lib_access;
  "lib/activity": typeof lib_activity;
  "lib/apiTokens": typeof lib_apiTokens;
  "lib/auth": typeof lib_auth;
  "lib/bots": typeof lib_bots;
  "lib/brevo": typeof lib_brevo;
  "lib/commentActions": typeof lib_commentActions;
  "lib/commentBody": typeof lib_commentBody;
  "lib/commentReactions": typeof lib_commentReactions;
  "lib/files": typeof lib_files;
  "lib/invites": typeof lib_invites;
  "lib/mcp/server": typeof lib_mcp_server;
  "lib/mcp/taskText": typeof lib_mcp_taskText;
  "lib/mcp/tools": typeof lib_mcp_tools;
  "lib/notificationEmail": typeof lib_notificationEmail;
  "lib/notificationItems": typeof lib_notificationItems;
  "lib/notifications": typeof lib_notifications;
  "lib/ordering": typeof lib_ordering;
  "lib/passwordResetEmail": typeof lib_passwordResetEmail;
  "lib/plural": typeof lib_plural;
  "lib/presence": typeof lib_presence;
  "lib/projectMembers": typeof lib_projectMembers;
  "lib/storage": typeof lib_storage;
  "lib/svg": typeof lib_svg;
  "lib/taskActions": typeof lib_taskActions;
  "lib/taskContent": typeof lib_taskContent;
  "lib/taskSeen": typeof lib_taskSeen;
  "lib/taskStatuses": typeof lib_taskStatuses;
  "lib/tasks": typeof lib_tasks;
  "lib/validation": typeof lib_validation;
  mcp: typeof mcp;
  mcpTools: typeof mcpTools;
  migrations: typeof migrations;
  notificationItems: typeof notificationItems;
  notifications: typeof notifications;
  organizationPurge: typeof organizationPurge;
  organizations: typeof organizations;
  presence: typeof presence;
  projects: typeof projects;
  taskContent: typeof taskContent;
  taskSeen: typeof taskSeen;
  taskStatuses: typeof taskStatuses;
  tasks: typeof tasks;
  users: typeof users;
  workspace: typeof workspace;
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
