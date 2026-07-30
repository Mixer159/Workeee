"use client";

import { useContext } from "react";
import {
  OrganizationContext,
  type OrganizationContextValue,
} from "@/components/providers/organization-provider";

/**
 * The organization the app shell is currently scoped to. Every organization-
 * scoped query takes its id from here and skips while it is null.
 */
export function useCurrentOrganization(): OrganizationContextValue {
  const value = useContext(OrganizationContext);
  if (!value) {
    throw new Error(
      "useCurrentOrganization musí být uvnitř OrganizationProvider.",
    );
  }
  return value;
}
