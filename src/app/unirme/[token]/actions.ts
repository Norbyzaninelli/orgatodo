"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfessional } from "@/lib/auth";
import { CentroError, joinWithInvite } from "@/lib/centros";
import type { FormState } from "@/lib/form-state";

export async function joinCentroAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const token = z.string().regex(/^[0-9a-f]{48}$/).parse(formData.get("token"));
  try {
    await joinWithInvite(pro, token);
  } catch (error) {
    if (error instanceof CentroError) return { error: error.message };
    throw error;
  }
  redirect("/panel/centro");
}
