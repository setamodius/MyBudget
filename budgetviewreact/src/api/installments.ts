import client from "./client"
import type { InstallmentPlan, InstallmentPlanDetail, InstallmentPlanFormData } from "@/types"

export const getInstallmentPlans = async (): Promise<InstallmentPlan[]> => {
  const { data } = await client.get("/installment-plans")
  return data
}

export const getInstallmentPlanDetail = async (id: number): Promise<InstallmentPlanDetail[]> => {
  const { data } = await client.get(`/installment-plans/${id}`)
  return data
}

export const createInstallmentPlan = async (body: InstallmentPlanFormData): Promise<{ id: number }> => {
  const { data } = await client.post("/installment-plans", body)
  return data
}

export const deleteInstallmentPlan = async (id: number): Promise<void> => {
  await client.delete(`/installment-plans/${id}`)
}
